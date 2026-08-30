/**
 * payouts.repository.ts
 *
 * All database reads/writes for the payout module.
 *
 * The payouts state machine (Tier 3):
 *   pending → queued → processing → success | failed → retry | manual_review
 *
 * A payout is only marked success AFTER the disbursement provider confirms
 * the transaction (completed_at + transaction_reference set together).
 */

import { Injectable } from '@nestjs/common';
import { TransactionSql } from 'postgres';
import { getPool, inTransaction, RlsContext } from '../../config/database.config';

export type PayoutStatus =
    | 'pending'
    | 'approved'
    | 'batched'
    | 'queued'
    | 'processing'
    | 'success'
    | 'completed'
    | 'failed'
    | 'retry'
    | 'manual_review';

export interface PayoutRecord {
    id: string;
    equb_id: string;
    round_number: number;
    winner_id: string;
    total_pot_amount: number;
    status: PayoutStatus;
    provider: string | null;
    transaction_reference: string | null;
    requested_at: Date | null;
    completed_at: Date | null;
    failure_reason: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface PayoutWinner {
    payout_id: string;
    first_name: string;
    last_name: string;
    phone: string;
}

export interface PayoutBatchRun {
    id: string;
    provider: string;
    total_amount: number;
    total_payouts: number;
    status: 'pending' | 'queued' | 'processing' | 'success' | 'failed';
    created_at: Date;
    completed_at: Date | null;
}

@Injectable()
export class PayoutsRepository {
    // ── Reads ───────────────────────────────────────────────────────────────

    async getPayoutById(payoutId: string): Promise<PayoutRecord | null> {
        const sql = getPool();
        const rows = await sql<PayoutRecord[]>`
      SELECT id, equb_id, round_number, winner_id, total_pot_amount, status,
             provider, transaction_reference, requested_at, completed_at,
             failure_reason, created_at, updated_at
      FROM payouts
      WHERE id = ${payoutId}
      LIMIT 1
    `;
        return rows[0] ?? null;
    }

    async getPayoutsByStatus(statuses: PayoutStatus[]): Promise<PayoutRecord[]> {
        const sql = getPool();
        return sql<PayoutRecord[]>`
      SELECT id, equb_id, round_number, winner_id, total_pot_amount, status,
             provider, transaction_reference, requested_at, completed_at,
             failure_reason, created_at, updated_at
      FROM payouts
      WHERE status = ANY(${statuses}::payout_status[])
      ORDER BY created_at ASC
      LIMIT 200
    `;
    }

    async listPayouts(equbId?: string): Promise<PayoutRecord[]> {
        const sql = getPool();
        if (equbId) {
            return sql<PayoutRecord[]>`
        SELECT id, equb_id, round_number, winner_id, total_pot_amount, status,
               provider, transaction_reference, requested_at, completed_at,
               failure_reason, created_at, updated_at
        FROM payouts
        WHERE equb_id = ${equbId}
        ORDER BY created_at DESC
      `;
        }
        return sql<PayoutRecord[]>`
      SELECT id, equb_id, round_number, winner_id, total_pot_amount, status,
             provider, transaction_reference, requested_at, completed_at,
             failure_reason, created_at, updated_at
      FROM payouts
      ORDER BY created_at DESC
      LIMIT 500
    `;
    }

    async getWinnerDetails(payoutId: string): Promise<PayoutWinner | null> {
        const sql = getPool();
        const rows = await sql<PayoutWinner[]>`
      SELECT p.id AS payout_id, u.first_name, u.last_name, u.phone
      FROM payouts p
      JOIN users u ON u.id = p.winner_id
      WHERE p.id = ${payoutId}
      LIMIT 1
    `;
        return rows[0] ?? null;
    }

    // ── State transitions ───────────────────────────────────────────────────

    /**
     * Atomically transitions a payout from one of `fromStatuses` to `toStatus`.
     * The row is locked FOR UPDATE so two processes cannot race on the same
     * payout. Returns the updated payout, or null when the current status is
     * not in `fromStatuses` (already processed → idempotent skip).
     */
    async transitionPayout(
        payoutId: string,
        fromStatuses: PayoutStatus[],
        toStatus: PayoutStatus,
        fields: {
            provider?: string;
            transactionReference?: string;
            completedAt?: Date;
            failureReason?: string;
        },
        ctx: RlsContext,
    ): Promise<PayoutRecord | null> {
        return inTransaction(ctx, async (tx: TransactionSql) => {
            const [row] = await tx<PayoutRecord[]>`
        SELECT id
        FROM payouts
        WHERE id = ${payoutId}
        FOR UPDATE
      `;
            if (!row) return null;

            const [updated] = await tx<PayoutRecord[]>`
        UPDATE payouts
        SET status              = ${toStatus},
            provider            = COALESCE(${fields.provider ?? null}, provider),
            transaction_reference = COALESCE(${fields.transactionReference ?? null}, transaction_reference),
            completed_at        = COALESCE(${fields.completedAt ?? null}, completed_at),
            failure_reason      = COALESCE(${fields.failureReason ?? null}, failure_reason),
            requested_at        = COALESCE(requested_at, NOW()),
            updated_at          = NOW()
        WHERE id = ${payoutId}
          AND status = ANY(${fromStatuses}::payout_status[])
        RETURNING id, equb_id, round_number, winner_id, total_pot_amount, status,
                  provider, transaction_reference, requested_at, completed_at,
                  failure_reason, created_at, updated_at
      `;
            return updated ?? null;
        });
    }

    async setPayoutProcessing(
        payoutId: string,
        ctx: RlsContext,
    ): Promise<PayoutRecord | null> {
        return this.transitionPayout(
            payoutId,
            ['pending', 'queued', 'retry'],
            'processing',
            {},
            ctx,
        );
    }

    async markPayoutSuccess(
        payoutId: string,
        transactionReference: string,
        provider: string,
        ctx: RlsContext,
    ): Promise<PayoutRecord | null> {
        return this.transitionPayout(
            payoutId,
            ['processing'],
            'success',
            { transactionReference, provider, completedAt: new Date() },
            ctx,
        );
    }

    async markPayoutFailed(
        payoutId: string,
        failureReason: string,
        ctx: RlsContext,
    ): Promise<PayoutRecord | null> {
        return this.transitionPayout(
            payoutId,
            ['processing'],
            'failed',
            { failureReason },
            ctx,
        );
    }

    async retryPayout(
        payoutId: string,
        ctx: RlsContext,
    ): Promise<PayoutRecord | null> {
        return this.transitionPayout(payoutId, ['failed'], 'queued', {}, ctx);
    }

    async holdForManualReview(
        payoutId: string,
        reason: string,
        ctx: RlsContext,
    ): Promise<PayoutRecord | null> {
        return this.transitionPayout(
            payoutId,
            ['processing', 'failed'],
            'manual_review',
            { failureReason: reason },
            ctx,
        );
    }

    // ── Batch runs ──────────────────────────────────────────────────────────

    async createPayoutBatchRun(
        provider: string,
        totalAmount: number,
        totalPayouts: number,
    ): Promise<PayoutBatchRun> {
        const sql = getPool();
        const [run] = await sql<PayoutBatchRun[]>`
      INSERT INTO payout_batch_runs (provider, total_amount, total_payouts, status)
      VALUES (${provider}, ${totalAmount}, ${totalPayouts}, 'processing')
      RETURNING id, provider, total_amount, total_payouts, status, created_at, completed_at
    `;
        return run;
    }

    async completePayoutBatchRun(
        batchRunId: string,
        status: 'success' | 'failed',
    ): Promise<void> {
        const sql = getPool();
        await sql`
      UPDATE payout_batch_runs
      SET status       = ${status},
          completed_at = NOW()
      WHERE id = ${batchRunId}
    `;
    }

    /** Links the legacy per-payout scheduler row to the batch run. */
    async linkPayoutToBatchRun(
        payoutId: string,
        batchRunId: string,
        transactionReference: string,
    ): Promise<void> {
        const sql = getPool();
        await sql`
      INSERT INTO payout_batches
        (payout_id, amount, scheduled_date, processed_at, transaction_reference, status, batch_run_id)
      SELECT p.id, p.total_pot_amount, CURRENT_DATE, NOW(), ${transactionReference}, 'paid', ${batchRunId}
      FROM payouts p
      WHERE p.id = ${payoutId}
      ON CONFLICT (transaction_reference) DO NOTHING
    `;
    }
}