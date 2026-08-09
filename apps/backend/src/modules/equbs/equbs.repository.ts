import { Injectable } from '@nestjs/common';
import { getPool, inTransaction, RlsContext } from '../../config/database.config';

export interface EqubGroupRecord {
    id: string;
    host_id: string;
    name: string;
    description: string | null;
    telegram_group_id: number | null;
    total_amount: number;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
    current_round: number;
    status: 'open' | 'active' | 'completed' | 'cancelled';
    social_fund_balance: number;
    created_at: Date;
}

export interface CreateEqubInput {
    name: string;
    description?: string;
    total_amount: number;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
}

@Injectable()
export class EqubsRepository {
    async findAll(): Promise<any[]> {
        const sql = getPool();
        return sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.created_at, e.updated_at,
                u.first_name AS host_first_name,
                u.last_name  AS host_last_name,
                u.phone      AS host_phone,
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id)::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id)::int, 0) AS open_slots
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            ORDER BY e.created_at DESC
        `;
    }

    async findById(id: string): Promise<any | null> {
        const sql = getPool();
        const rows = await sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.created_at, e.updated_at,
                u.first_name AS host_first_name,
                u.last_name  AS host_last_name,
                u.phone      AS host_phone,
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id)::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id)::int, 0) AS open_slots
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            WHERE e.id = ${id}
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    /**
     * Equbs the user belongs to — either as host or as a member.
     */
    async findMine(userId: string): Promise<any[]> {
        const sql = getPool();
        return sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.created_at, e.updated_at,
                u.first_name AS host_first_name,
                u.last_name  AS host_last_name,
                u.phone      AS host_phone,
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id)::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id)::int, 0) AS open_slots,
                (e.host_id = ${userId}) AS is_host
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            WHERE e.host_id = ${userId}
               OR EXISTS (SELECT 1 FROM memberships mm WHERE mm.equb_id = e.id AND mm.user_id = ${userId})
            ORDER BY e.created_at DESC
        `;
    }

    async create(input: CreateEqubInput, hostId: string, ctx: RlsContext): Promise<any> {
        return inTransaction(ctx, async (tx) => {
            const [equb] = await tx`
                INSERT INTO equb_groups
                    (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds)
                VALUES
                    (${hostId}, ${input.name}, ${input.description ?? null}, ${input.total_amount}, ${input.contribution_amount}, ${input.cycle_days}, ${input.total_rounds})
                RETURNING id, host_id, name, total_amount, contribution_amount, cycle_days, total_rounds, current_round, status, created_at
            `;

            // Host is automatically the first member.
            await tx`
                INSERT INTO memberships (user_id, equb_id)
                VALUES (${hostId}, ${equb.id})
                ON CONFLICT (user_id, equb_id) DO NOTHING
            `;

            return equb;
        });
    }

    async join(equbId: string, userId: string, ctx: RlsContext): Promise<any> {
        return inTransaction(ctx, async (tx) => {
            const [equb] = await tx`
                SELECT id, status, total_rounds, current_round
                FROM equb_groups
                WHERE id = ${equbId}
                FOR UPDATE
            `;

            if (!equb) {
                return { success: false, error: 'EQUB_NOT_FOUND', message: 'Equb group not found' };
            }
            if (equb.status === 'completed' || equb.status === 'cancelled') {
                return { success: false, error: 'EQUB_CLOSED', message: 'This Equb is no longer accepting members' };
            }

            const existing = await tx`
                SELECT id FROM memberships WHERE user_id = ${userId} AND equb_id = ${equbId}
            `;
            if (existing.length > 0) {
                return { success: false, error: 'ALREADY_MEMBER', message: 'You are already a member of this Equb' };
            }

            const totalCapacity = equb.total_rounds;
            const [{ count }] = await tx`
                SELECT COUNT(*)::int AS count FROM memberships WHERE equb_id = ${equbId}
            `;
            if (count >= totalCapacity) {
                return { success: false, error: 'EQUB_FULL', message: 'This Equb group is full' };
            }

            const [membership] = await tx`
                INSERT INTO memberships (user_id, equb_id)
                VALUES (${userId}, ${equbId})
                RETURNING id, user_id, equb_id, joined_at
            `;

            return { success: true, membership, message: 'Joined Equb successfully' };
        });
    }
}
