/**
 * payouts.service.ts
 *
 * Disbursement orchestration (Tier 3, Phase 3.4).
 *
 * State machine:
 *   pending → queued → processing → success | failed → retry | manual_review
 *
 * Key rule: a payout is ONLY marked `success` after the disbursement provider
 * confirms the transaction. Submitting the request is not enough — the
 * provider must return a gateway reference (completed_at + reference are set
 * together with the transition).
 */

import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';

import {
    PayoutsRepository,
    PayoutRecord,
} from './payouts.repository';
import { PayoutProviderService } from './providers/payout-provider.service';
import { buildTransactionReference } from '../payments/reference';
import { RlsContext } from '../../config/database.config';

/** Context used by system jobs — admin role so winner details are readable. */
export const SYSTEM_CONTEXT: RlsContext = { userId: 'system', userRole: 'admin' };

export interface PayoutProcessingResult {
    payout_id: string;
    status: 'success' | 'failed' | 'skipped' | 'manual_review';
    reference?: string;
    failure_reason?: string;
}

@Injectable()
export class PayoutsService {
    private readonly logger = new Logger(PayoutsService.name);

    constructor(
        private readonly repo: PayoutsRepository,
        private readonly providerService: PayoutProviderService,
    ) { }

    // ── Reads ───────────────────────────────────────────────────────────────

    async listPayouts(equbId?: string): Promise<PayoutRecord[]> {
        return this.repo.listPayouts(equbId);
    }

    async getPayout(payoutId: string): Promise<PayoutRecord> {
        const payout = await this.repo.getPayoutById(payoutId);
        if (!payout) throw new NotFoundException('Payout record not found.');
        return payout;
    }

    // ── State machine ───────────────────────────────────────────────────────

    /** pending → queued. Idempotent — a payout already past pending is returned as-is. */
    async queuePayout(
        payoutId: string,
        ctx: RlsContext,
    ): Promise<{ status: string; payout: PayoutRecord | null }> {
        const updated = await this.repo.transitionPayout(
            payoutId,
            ['pending'],
            'queued',
            { provider: this.providerService.currentMode === 'live' ? 'bank' : 'sandbox-bank' },
            ctx,
        );
        if (!updated) {
            const current = await this.repo.getPayoutById(payoutId);
            return { status: current?.status ?? 'not_found', payout: current };
        }
        return { status: 'queued', payout: updated };
    }

    /**
     * Runs a single payout end-to-end:
     *   processing → provider.disburse → success | failed
     */
    async processPayout(
        payoutId: string,
        ctx: RlsContext,
    ): Promise<PayoutProcessingResult> {
        // Guard: only payouts currently pending/queued/retry are processed.
        const payout = await this.repo.setPayoutProcessing(payoutId, ctx);
        if (!payout) {
            const current = await this.repo.getPayoutById(payoutId);
            return {
                payout_id: payoutId,
                status: 'skipped',
                failure_reason: current
                    ? `Payout is already ${current.status}.`
                    : 'Payout record not found.',
            };
        }

        const winner = await this.repo.getWinnerDetails(payoutId);
        if (!winner) {
            await this.repo.holdForManualReview(
                payoutId,
                'Winner account details not found.',
                ctx,
            );
            return {
                payout_id: payoutId,
                status: 'manual_review',
                failure_reason: 'Winner account details not found.',
            };
        }

        const provider = this.providerService.resolve(payout.provider ?? 'sandbox-bank');
        const txRef = buildTransactionReference(
            'PAY',
            payout.equb_id,
            payout.round_number,
            payout.winner_id,
        );

        this.logger.log(
            `[Payout] Sending ${payout.total_pot_amount} ETB to ${winner.phone} (${provider.name})`,
        );

        const result = await provider.disburse({
            amount: payout.total_pot_amount,
            currency: 'ETB',
            recipientName: `${winner.first_name} ${winner.last_name}`.trim(),
            recipientPhone: winner.phone,
            reference: txRef,
            metadata: {
                equb_id: payout.equb_id,
                round_number: payout.round_number,
                payout_id: payout.id,
            },
        });

        // Only a provider confirmation marks the payout SUCCESS.
        if (result.success && result.reference) {
            const updated = await this.repo.markPayoutSuccess(
                payoutId,
                result.reference,
                provider.name,
                ctx,
            );
            if (updated) {
                this.logger.log(
                    `[Payout] Confirmed ${updated.id} → success (${result.reference})`,
                );
            }
            return {
                payout_id: payoutId,
                status: 'success',
                reference: result.reference,
            };
        }

        const reason = result.failureReason ?? 'Provider did not confirm the transaction.';
        await this.repo.markPayoutFailed(payoutId, reason, ctx);
        this.logger.warn(`[Payout] Failed ${payoutId}: ${reason}`);
        return { payout_id: payoutId, status: 'failed', failure_reason: reason };
    }

    /**
     * Processes all ready payouts and groups them into a payout batch run.
     * Called by the scheduled PayoutTask (and by admins on demand).
     */
    async processPendingPayouts(ctx: RlsContext) {
        const payouts = await this.repo.getPayoutsByStatus([
            'pending',
            'queued',
            'retry',
        ]);

        if (payouts.length === 0) {
            return { processed: 0, succeeded: 0, failed: 0, batch_run_id: null };
        }

        const providerName =
            this.providerService.currentMode === 'live' ? 'bank' : 'sandbox-bank';
        const totalAmount = payouts.reduce(
            (sum, p) => sum + p.total_pot_amount,
            0,
        );

        const batchRun = await this.repo.createPayoutBatchRun(
            providerName,
            parseFloat(totalAmount.toFixed(2)),
            payouts.length,
        );

        let succeeded = 0;
        let failed = 0;

        for (const payout of payouts) {
            const result = await this.processPayout(payout.id, ctx);
            if (result.status === 'success') {
                succeeded++;
                await this.repo.linkPayoutToBatchRun(
                    payout.id,
                    batchRun.id,
                    result.reference ?? crypto.randomUUID(),
                );
            } else if (result.status === 'failed') {
                failed++;
            }
        }

        await this.repo.completePayoutBatchRun(
            batchRun.id,
            failed === 0 ? 'success' : 'failed',
        );

        return {
            processed: payouts.length,
            succeeded,
            failed,
            batch_run_id: batchRun.id,
        };
    }

    /** failed → queued (automatic retry). */
    async retryPayout(payoutId: string, ctx: RlsContext) {
        const updated = await this.repo.retryPayout(payoutId, ctx);
        if (!updated) {
            const current = await this.repo.getPayoutById(payoutId);
            return {
                status: current?.status ?? 'not_found',
                message: current
                    ? `Payout is currently ${current.status} — only failed payouts can be retried.`
                    : 'Payout record not found.',
            };
        }
        return { status: 'queued', message: 'Payout queued for retry.' };
    }

    /** processing/failed → manual_review (human intervention). */
    async holdForManualReview(
        payoutId: string,
        reason: string,
        ctx: RlsContext,
    ) {
        const updated = await this.repo.holdForManualReview(payoutId, reason, ctx);
        if (!updated) {
            const current = await this.repo.getPayoutById(payoutId);
            return {
                status: current?.status ?? 'not_found',
                message: current
                    ? `Payout is currently ${current.status} and cannot be put on hold.`
                    : 'Payout record not found.',
            };
        }
        return { status: 'manual_review', message: `Payout held for review: ${reason}` };
    }
}