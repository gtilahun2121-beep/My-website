/**
 * weekly-cycle.repository.ts
 *
 * Database access for the Weekly Equb cycle engine. Mirrors the Daily Equb
 * engine (daily-cycle.repository.ts) but is scoped to cycle_type = 'weekly'
 * and uses a 7-day period. It shares the cadence-agnostic daily_cycles and
 * cycle_penalties tables introduced by migration 015.
 *
 * All writes to RLS-protected tables (wallets) go through inTransaction()
 * with a resolved RLS context; the daily_cycles / cycle_penalties tables are
 * not RLS-protected, so they use the plain pool.
 */

import { Injectable } from '@nestjs/common';
import { getPool, inTransaction, RlsContext } from '../../config/database.config';

export interface WeeklyEqubRecord {
    id: string;
    host_id: string;
    name: string;
    contribution_amount: number;
    current_round: number;
    total_rounds: number;
    payment_cutoff_time: string;
    payment_cutoff_weekday: number;
    late_penalty_rate: number;
    last_cycle_date: Date | null;
}

export interface WeeklyCycleRecord {
    id: string;
    equb_id: string;
    /** The draw/cutoff date (Day 7) for this weekly cycle. */
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
export class WeeklyCycleRepository {
    // ── Reads ──────────────────────────────────────────────────────────────

    async findWeeklyEqub(equbId: string): Promise<WeeklyEqubRecord | null> {
        const sql = getPool();
        const rows = await sql<WeeklyEqubRecord[]>`
            SELECT
                id, host_id, name, contribution_amount,
                current_round, total_rounds,
                payment_cutoff_time,
                payment_cutoff_weekday,
                late_penalty_rate,
                last_cycle_date
            FROM equb_groups
            WHERE id = ${equbId}
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    async listActiveWeeklyEqubs(): Promise<WeeklyEqubRecord[]> {
        const sql = getPool();
        return sql<WeeklyEqubRecord[]>`
            SELECT
                id, host_id, name, contribution_amount,
                current_round, total_rounds,
                payment_cutoff_time,
                payment_cutoff_weekday,
                late_penalty_rate,
                last_cycle_date
            FROM equb_groups
            WHERE cycle_type = 'weekly'
              AND status      = 'active'
              AND current_round > 0
        `;
    }

    async getOpenCycle(equbId: string): Promise<WeeklyCycleRecord | null> {
        const sql = getPool();
        const rows = await sql<WeeklyCycleRecord[]>`
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
     * contribution for the given round. These are the late payers for the week.
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

    async openCycle(equbId: string, cycleDate: string): Promise<WeeklyCycleRecord> {
        const sql = getPool();
        const [row] = await sql<WeeklyCycleRecord[]>`
            INSERT INTO daily_cycles (equb_id, cycle_date, status)
            VALUES (${equbId}, ${cycleDate}::date, 'open')
            ON CONFLICT (equb_id, cycle_date) DO NOTHING
            RETURNING id, equb_id, cycle_date, status, round_number,
                      opened_at, closed_at, drawn_at
        `;
        if (row) return row;

        const existing = await this.getOpenCycle(equbId);
        if (existing) return existing;

        throw new Error(`Could not open weekly cycle for equb ${equbId} on ${cycleDate}`);
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

    /** Approved member user ids for an equb (used for window reminders). */
    async listApprovedMemberIds(equbId: string): Promise<string[]> {
        const sql = getPool();
        const rows = await sql<{ user_id: string }[]>`
            SELECT m.user_id
            FROM memberships m
            WHERE m.equb_id = ${equbId}
              AND m.status  = 'approved'
        `;
        return rows.map((r) => r.user_id);
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
     * Debits the penalty from the member's wallet (RLS-protected — must run
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

    // ── Type helpers ───────────────────────────────────────────────────────

    async isWeeklyEqub(equbId: string): Promise<boolean> {
        return (await this.getCycleType(equbId)) === 'weekly';
    }

    private async getCycleType(
        equbId: string,
    ): Promise<'round' | 'daily' | 'weekly'> {
        const sql = getPool();
        const rows = await sql<{ cycle_type: 'round' | 'daily' | 'weekly' }[]>`
            SELECT cycle_type FROM equb_groups WHERE id = ${equbId} LIMIT 1
        `;
        return rows[0]?.cycle_type ?? 'round';
    }
}
