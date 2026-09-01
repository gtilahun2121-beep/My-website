/**
 * daily-cycle.repository.ts
 *
 * Database access for the Daily Equb cycle engine. All writes to RLS-protected
 * tables (wallets) go through inTransaction() with a resolved RLS context; the
 * new daily_cycles / cycle_penalties tables are not RLS-protected, so they use
 * the plain pool.
 */

import { Injectable } from '@nestjs/common';
import { getPool, inTransaction, RlsContext } from '../../config/database.config';

export interface DailyEqubRecord {
    id: string;
    host_id: string;
    name: string;
    contribution_amount: number;
    current_round: number;
    total_rounds: number;
    payment_cutoff_time: string;
    late_penalty_rate: number;
    last_cycle_date: Date | null;
}

export interface DailyCycleRecord {
    id: string;
    equb_id: string;
    cycle_date: string;
    status: 'open' | 'closed' | 'drawn';
    round_number: number;
    opened_at: Date;
    closed_at: Date | null;
    drawn_at: Date | null;
}

export interface UnpaidMemberRecord {
    user_id: string;
    membership_id: string;
    payment_id: string | null;
}

@Injectable()
export class DailyCycleRepository {
    // ── Reads ──────────────────────────────────────────────────────────────

    async findDailyEqub(equbId: string): Promise<DailyEqubRecord | null> {
        const sql = getPool();
        const rows = await sql<DailyEqubRecord[]>`
            SELECT
                id, host_id, name, contribution_amount,
                current_round, total_rounds,
                payment_cutoff_time,
                late_penalty_rate,
                last_cycle_date
            FROM equb_groups
            WHERE id = ${equbId}
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    async listActiveDailyEqubs(): Promise<DailyEqubRecord[]> {
        const sql = getPool();
        return sql<DailyEqubRecord[]>`
            SELECT
                id, host_id, name, contribution_amount,
                current_round, total_rounds,
                payment_cutoff_time,
                late_penalty_rate,
                last_cycle_date
            FROM equb_groups
            WHERE cycle_type = 'daily'
              AND status      = 'active'
              AND current_round > 0
        `;
    }

    async getOpenCycle(equbId: string): Promise<DailyCycleRecord | null> {
        const sql = getPool();
        const rows = await sql<DailyCycleRecord[]>`
            SELECT id, equb_id, cycle_date, status, round_number,
                   opened_at, closed_at, drawn_at
            FROM daily_cycles
            WHERE equb_id = ${equbId}
              AND status  = 'open'
            ORDER BY cycle_date DESC
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    /**
     * Returns approved members who have NOT recorded a paid/auto-debited
     * contribution for the given round. These are the late payers.
     */
    async getApprovedMembersUnpaid(
        equbId: string,
        roundNumber: number,
    ): Promise<UnpaidMemberRecord[]> {
        const sql = getPool();
        return sql<UnpaidMemberRecord[]>`
            SELECT m.user_id, m.id AS membership_id, p.id AS payment_id
            FROM memberships m
            LEFT JOIN payments p
                   ON p.user_id  = m.user_id
                  AND p.equb_id  = m.equb_id
                  AND p.round_number = ${roundNumber}
                  AND p.payment_status IN ('paid', 'auto_debited')
            WHERE m.equb_id = ${equbId}
              AND m.status  = 'approved'
              AND p.id IS NULL
        `;
    }

    // ── Cycle lifecycle (plain pool — tables are not RLS-protected) ────────

    async openCycle(equbId: string, cycleDate: string): Promise<DailyCycleRecord> {
        const sql = getPool();
        const [row] = await sql<DailyCycleRecord[]>`
            INSERT INTO daily_cycles (equb_id, cycle_date, status)
            VALUES (${equbId}, ${cycleDate}::date, 'open')
            ON CONFLICT (equb_id, cycle_date) DO NOTHING
            RETURNING id, equb_id, cycle_date, status, round_number,
                      opened_at, closed_at, drawn_at
        `;
        if (row) return row;

        // Already present — return the existing open row.
        const existing = await this.getOpenCycle(equbId);
        if (existing) return existing;

        throw new Error(`Could not open daily cycle for equb ${equbId} on ${cycleDate}`);
    }

    async closeCycle(cycleId: string): Promise<void> {
        const sql = getPool();
        await sql`
            UPDATE daily_cycles
            SET status = 'closed', closed_at = NOW()
            WHERE id = ${cycleId} AND status = 'open'
        `;
    }

    async markCycleDrawn(cycleId: string): Promise<void> {
        const sql = getPool();
        await sql`
            UPDATE daily_cycles
            SET status = 'drawn', drawn_at = NOW()
            WHERE id = ${cycleId}
        `;
    }

    async setCycleRound(cycleId: string, roundNumber: number): Promise<void> {
        const sql = getPool();
        await sql`
            UPDATE daily_cycles
            SET round_number = ${roundNumber}
            WHERE id = ${cycleId}
        `;
    }

    async setLastCycleDate(equbId: string, cycleDate: string): Promise<void> {
        const sql = getPool();
        await sql`
            UPDATE equb_groups
            SET last_cycle_date = ${cycleDate}::date, updated_at = NOW()
            WHERE id = ${equbId}
        `;
    }

    async getAdminId(): Promise<string | null> {
        const sql = getPool();
        const rows = await sql<{ id: string }[]>`
            SELECT id FROM users WHERE role = 'admin' LIMIT 1
        `;
        return rows[0]?.id ?? null;
    }

    // ── Penalties (plain pool) ─────────────────────────────────────────────

    async insertPenalty(input: {
        equbId: string;
        cycleId: string | null;
        userId: string;
        cycleDate: string;
        amount: number;
        reason: string;
    }): Promise<void> {
        const sql = getPool();
        await sql`
            INSERT INTO cycle_penalties
                (equb_id, cycle_id, user_id, cycle_date, amount, reason)
            VALUES
                (${input.equbId}, ${input.cycleId}, ${input.userId},
                 ${input.cycleDate}::date, ${input.amount}, ${input.reason})
            ON CONFLICT (equb_id, user_id, cycle_date) DO NOTHING
        `;
    }

    /**
     * Debited the penalty from the member's wallet (RLS-protected — must run
     * inside a transaction with the member's context). Does not go negative.
     */
    async deductWalletPenalty(
        userId: string,
        amount: number,
        tx: any,
    ): Promise<boolean> {
        const result = await tx<{ id: string }[]>`
            UPDATE wallets
            SET balance = balance - ${amount}, updated_at = NOW()
            WHERE user_id = ${userId}
              AND balance >= ${amount}
            RETURNING id
        `;
        return result.length > 0;
    }

    // ── Payment-window enforcement ─────────────────────────────────────────

    /**
     * For daily equbs, returns true only while the current day's window is
     * open (before the local cutoff time). Classic round-based equbs always
     * return true (payments are accepted whenever the equb is active).
     */
    async isPaymentWindowOpen(equbId: string): Promise<boolean> {
        const equb = await this.findDailyEqub(equbId);
        if (!equb) return false;

        if (await this.isDailyEqub(equbId)) {
            const now = new Date();
            const [hh, mm] = equb.payment_cutoff_time
                .split(':')
                .map((s) => parseInt(s, 10));
            const cutoff = new Date(now);
            cutoff.setHours(hh ?? 17, mm ?? 0, 0, 0);
            return now < cutoff;
        }
        return true;
    }

    async isDailyEqub(equbId: string): Promise<boolean> {
        return (await this.getCycleType(equbId)) === 'daily';
    }

    private async getCycleType(equbId: string): Promise<'round' | 'daily'> {
        const sql = getPool();
        const rows = await sql<{ cycle_type: 'round' | 'daily' }[]>`
            SELECT cycle_type FROM equb_groups WHERE id = ${equbId} LIMIT 1
        `;
        return rows[0]?.cycle_type ?? 'round';
    }
}
