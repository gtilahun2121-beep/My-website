/**
 * reconciliation.service.ts
 *
 * End-of-day reconciliation (Tier 3, Phase 3.5).
 *
 * Compares QAL records against the gateway/bank ledger and flags:
 *   missing         — a QAL transaction the provider never confirmed
 *   duplicate       — the same transaction reference recorded more than once
 *   failed          — payments the provider rejected / that errored
 *   unmatched       — gateway transactions with no QAL counterpart
 *   amount_mismatch — confirmed amounts that differ between QAL and gateway
 *
 * In sandbox mode the provider ledger is synthesised from confirmed QAL
 * records (the mock gateway confirms everything). In live mode a real ledger
 * fetch is plugged in via the optional `providerLedger` parameter.
 */

import { Injectable, Logger } from '@nestjs/common';

import {
    ReconciliationRepository,
    ReconciliationPaymentRow,
} from './reconciliation.repository';

export interface GatewayLedgerEntry {
    txRef: string;
    amount: number;
}

export interface ReconciliationRunResult {
    run_id: string;
    run_date: string;
    skipped: boolean;
    missing: number;
    duplicate: number;
    failed: number;
    unmatched: number;
    amount_mismatch: number;
}

const DEFAULT_STALE_PENDING_DAYS = 2;

@Injectable()
export class ReconciliationService {
    private readonly logger = new Logger(ReconciliationService.name);

    constructor(private readonly repo: ReconciliationRepository) { }

    /**
     * Sandbox ledger — the mock gateway confirms every paid QAL transaction,
     * so unmatched / amount-mismatch analysis runs cleanly in development.
     */
    buildSandboxLedger(
        payments: ReconciliationPaymentRow[],
    ): GatewayLedgerEntry[] {
        return payments
            .filter(
                (p) =>
                    (p.payment_status === 'paid' || p.payment_status === 'auto_debited') &&
                    p.transaction_reference,
            )
            .map((p) => ({
                txRef: p.transaction_reference!,
                amount: p.amount,
            }));
    }

    /**
     * Runs the reconciliation for a date. Idempotent per run_date — a second
     * call for the same date skips when the run already completed.
     */
    async runReconciliation(
        runDate = new Date(),
        providerLedger?: GatewayLedgerEntry[],
    ): Promise<ReconciliationRunResult> {
        const dateKey = runDate.toISOString().slice(0, 10);

        const existing = await this.repo.getRunByDate(dateKey);
        if (existing && existing.status === 'completed') {
            return {
                run_id: existing.id,
                run_date: dateKey,
                skipped: true,
                missing: existing.missing_count,
                duplicate: existing.duplicate_count,
                failed: existing.failed_count,
                unmatched: existing.unmatched_count,
                amount_mismatch: existing.amount_mismatch_count,
            };
        }

        const run = await this.repo.createRun(dateKey);
        const payments = await this.repo.getPaymentsForReconciliation();

        const counts = {
            missing: 0,
            duplicate: 0,
            failed: 0,
            unmatched: 0,
            amountMismatch: 0,
        };

        // 1. Failed payments.
        for (const p of payments.filter((p) => p.payment_status === 'failed')) {
            await this.repo.addIssue(run.id, 'failed', {
                transactionReference: p.transaction_reference,
                provider: p.provider,
                expectedAmount: p.amount,
                actualAmount: p.amount,
                details: { payment_id: p.id, user_id: p.user_id, equb_id: p.equb_id },
            });
            counts.failed++;
        }

        // 2. Stale pending payments — the provider never confirmed them.
        const staleCutoff = new Date(runDate.getTime());
        staleCutoff.setUTCDate(
            staleCutoff.getUTCDate() - Number(process.env.RECONCILIATION_STALE_DAYS ?? DEFAULT_STALE_PENDING_DAYS),
        );
        for (const p of payments.filter(
            (p) => p.payment_status === 'pending' && p.created_at < staleCutoff,
        )) {
            await this.repo.addIssue(run.id, 'missing', {
                transactionReference: p.transaction_reference,
                provider: p.provider,
                expectedAmount: p.amount,
                actualAmount: null,
                details: { payment_id: p.id, user_id: p.user_id, equb_id: p.equb_id },
            });
            counts.missing++;
        }

        // 3. Duplicate transaction references.
        const refGroups = new Map<string, ReconciliationPaymentRow[]>();
        for (const p of payments.filter((p) => p.transaction_reference)) {
            const key = p.transaction_reference!;
            if (!refGroups.has(key)) refGroups.set(key, []);
            refGroups.get(key)!.push(p);
        }
        for (const [, group] of refGroups) {
            if (group.length < 2) continue;
            await this.repo.addIssue(run.id, 'duplicate', {
                transactionReference: group[0].transaction_reference,
                provider: group[0].provider,
                expectedAmount: group[0].amount,
                actualAmount: group[1].amount,
                details: { payment_ids: group.map((g) => g.id) },
            });
            counts.duplicate++;
        }

        // 4/5. Compare against the provider ledger (unmatched + amount mismatch).
        const ledger = providerLedger ?? this.buildSandboxLedger(payments);
        const ledgerMap = new Map<string, GatewayLedgerEntry>();
        for (const entry of ledger) {
            if (!ledgerMap.has(entry.txRef)) ledgerMap.set(entry.txRef, entry);
        }

        for (const p of payments.filter(
            (p) =>
                (p.payment_status === 'paid' || p.payment_status === 'auto_debited') &&
                p.transaction_reference,
        )) {
            const gateway = ledgerMap.get(p.transaction_reference!);

            if (!gateway) {
                await this.repo.addIssue(run.id, 'unmatched', {
                    transactionReference: p.transaction_reference,
                    provider: p.provider,
                    expectedAmount: p.amount,
                    actualAmount: null,
                    details: { payment_id: p.id },
                });
                counts.unmatched++;
                continue;
            }

            if (Math.abs(gateway.amount - p.amount) > 0.01) {
                await this.repo.addIssue(run.id, 'amount_mismatch', {
                    transactionReference: p.transaction_reference,
                    provider: p.provider,
                    expectedAmount: p.amount,
                    actualAmount: gateway.amount,
                    details: { payment_id: p.id },
                });
                counts.amountMismatch++;
            }
        }

        await this.repo.completeRun(run.id, counts);

        this.logger.log(
            `[Reconciliation] ${dateKey}: missing=${counts.missing} duplicate=${counts.duplicate} ` +
            `failed=${counts.failed} unmatched=${counts.unmatched} amount_mismatch=${counts.amountMismatch}`,
        );

        return {
            run_id: run.id,
            run_date: dateKey,
            skipped: false,
            missing: counts.missing,
            duplicate: counts.duplicate,
            failed: counts.failed,
            unmatched: counts.unmatched,
            amount_mismatch: counts.amountMismatch,
        };
    }

    /** Returns all issues recorded for a given reconciliation run. */
    async getIssues(runId: string) {
        return this.repo.listIssues(runId);
    }
}