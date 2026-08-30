/**
 * reconciliation.repository.ts
 *
 * Persists reconciliation runs and the issues they detect (Tier 3, Phase 3.5).
 *
 * Every night QAL compares its records with the gateway's records and flags:
 *   missing, duplicate, failed, unmatched transactions and incorrect amounts.
 */

import { Injectable } from '@nestjs/common';
import { getPool } from '../../config/database.config';

export type ReconciliationIssueType =
    | 'missing'
    | 'duplicate'
    | 'failed'
    | 'unmatched'
    | 'amount_mismatch';

export interface ReconciliationPaymentRow {
    id: string;
    user_id: string;
    equb_id: string;
    round_number: number;
    amount: number;
    payment_status: 'pending' | 'paid' | 'auto_debited' | 'failed';
    transaction_reference: string | null;
    provider: string | null;
    paid_at: Date | null;
    created_at: Date;
}

export interface ReconciliationRunRecord {
    id: string;
    run_date: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    missing_count: number;
    duplicate_count: number;
    failed_count: number;
    unmatched_count: number;
    amount_mismatch_count: number;
    created_at: Date;
    completed_at: Date | null;
}

@Injectable()
export class ReconciliationRepository {
    // ── Runs ────────────────────────────────────────────────────────────────

    async getRunByDate(runDate: string): Promise<ReconciliationRunRecord | null> {
        const sql = getPool();
        const rows = await sql<ReconciliationRunRecord[]>`
      SELECT id, run_date, status, missing_count, duplicate_count, failed_count,
             unmatched_count, amount_mismatch_count, created_at, completed_at
      FROM reconciliation_runs
      WHERE run_date = ${runDate}
      LIMIT 1
    `;
        return rows[0] ?? null;
    }

    async createRun(runDate: string): Promise<ReconciliationRunRecord> {
        const sql = getPool();
        const [run] = await sql<ReconciliationRunRecord[]>`
      INSERT INTO reconciliation_runs (run_date, status)
      VALUES (${runDate}, 'running')
      ON CONFLICT (run_date) DO UPDATE SET status = 'running'
      RETURNING id, run_date, status, missing_count, duplicate_count, failed_count,
                unmatched_count, amount_mismatch_count, created_at, completed_at
    `;
        return run;
    }

    async completeRun(
        runId: string,
        counts: {
            missing: number;
            duplicate: number;
            failed: number;
            unmatched: number;
            amountMismatch: number;
        },
    ): Promise<void> {
        const sql = getPool();
        await sql`
      UPDATE reconciliation_runs
      SET status              = 'completed',
          missing_count       = ${counts.missing},
          duplicate_count     = ${counts.duplicate},
          failed_count        = ${counts.failed},
          unmatched_count     = ${counts.unmatched},
          amount_mismatch_count = ${counts.amountMismatch},
          completed_at        = NOW()
      WHERE id = ${runId}
    `;
    }

    // ── Issues ──────────────────────────────────────────────────────────────

    async addIssue(
        runId: string,
        issueType: ReconciliationIssueType,
        fields: {
            transactionReference?: string | null;
            provider?: string | null;
            expectedAmount?: number | null;
            actualAmount?: number | null;
            details?: Record<string, unknown>;
        },
    ): Promise<void> {
        const sql = getPool();
        await sql`
      INSERT INTO reconciliation_issues
        (run_id, issue_type, transaction_reference, provider, expected_amount, actual_amount, details)
      VALUES
        (${runId}, ${issueType}, ${fields.transactionReference ?? null},
         ${fields.provider ?? null}, ${fields.expectedAmount ?? null}, ${fields.actualAmount ?? null},
         ${JSON.stringify(fields.details ?? {})})
    `;
    }

    // ── Payment data for analysis ───────────────────────────────────────────

    async getPaymentsForReconciliation(): Promise<ReconciliationPaymentRow[]> {
        const sql = getPool();
        return sql<ReconciliationPaymentRow[]>`
      SELECT id, user_id, equb_id, round_number, amount, payment_status,
             transaction_reference, provider, paid_at, created_at
      FROM payments
      ORDER BY created_at ASC
    `;
    }

    async listIssues(runId: string) {
        const sql = getPool();
        return sql`
      SELECT id, run_id, issue_type, transaction_reference, provider,
             expected_amount, actual_amount, details, created_at
      FROM reconciliation_issues
      WHERE run_id = ${runId}
      ORDER BY created_at ASC
    `;
    }
}