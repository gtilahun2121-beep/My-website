import { Injectable } from '@nestjs/common';
import { getPool, inTransaction, withAdminContext, RlsContext } from '../../config/database.config';

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

export interface CreateRequestInput {
    name: string;
    description?: string;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
}

export type MembershipStatus = 'pending' | 'approved' | 'rejected';

@Injectable()
export class EqubsRepository {
    // ── Read ──────────────────────────────────────────────────────────────────

    async getUserName(userId: string): Promise<{ first_name: string; last_name: string } | null> {
        const sql = getPool();
        const rows = await sql<{ first_name: string; last_name: string }[]>`
            SELECT first_name, last_name FROM users WHERE id = ${userId}
        `;
        return rows[0] ?? null;
    }

    async getEqubName(equbId: string): Promise<string | null> {
        const sql = getPool();
        const rows = await sql`SELECT name FROM equb_groups WHERE id = ${equbId}`;
        return rows[0]?.name ?? null;
    }

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
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int, 0) AS open_slots
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            ORDER BY e.created_at DESC
        `;
    }

    async findById(id: string, userId?: string): Promise<any | null> {
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
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int, 0) AS open_slots,
                CASE
                    WHEN ${userId ?? null} IS NOT NULL THEN (
                        SELECT mm.status FROM memberships mm
                        WHERE mm.equb_id = e.id AND mm.user_id = ${userId ?? null}
                        LIMIT 1
                    )
                    ELSE NULL
                END AS membership_status
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            WHERE e.id = ${id}
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    /**
     * Equbs the user belongs to — as host, or as an approved/pending member.
     * Rejected memberships are not surfaced here.
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
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int, 0) AS open_slots,
                (e.host_id = ${userId}) AS is_host,
                (SELECT mm.status FROM memberships mm
                 WHERE mm.equb_id = e.id AND mm.user_id = ${userId}
                 LIMIT 1) AS membership_status
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            WHERE e.host_id = ${userId}
               OR EXISTS (SELECT 1 FROM memberships mm
                          WHERE mm.equb_id = e.id AND mm.user_id = ${userId}
                            AND mm.status IN ('approved', 'pending'))
            ORDER BY e.created_at DESC
        `;
    }

    // ── Create (admin only — enforced by RolesGuard at the controller) ─────────

    async create(input: CreateEqubInput, hostId: string, ctx: RlsContext): Promise<any> {
        return inTransaction(ctx, async (tx) => {
            const [equb] = await tx`
                INSERT INTO equb_groups
                    (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds)
                VALUES
                    (${hostId}, ${input.name}, ${input.description ?? null}, ${input.total_amount}, ${input.contribution_amount}, ${input.cycle_days}, ${input.total_rounds})
                RETURNING id, host_id, name, total_amount, contribution_amount, cycle_days, total_rounds, current_round, status, created_at
            `;

            // Host is automatically the first member (approved).
            await tx`
                INSERT INTO memberships (user_id, equb_id, status)
                VALUES (${hostId}, ${equb.id}, 'approved')
                ON CONFLICT (user_id, equb_id) DO NOTHING
            `;

            return equb;
        });
    }

    // ── Join (creates a PENDING membership unless the caller is admin) ─────────

    async join(equbId: string, userId: string, ctx: RlsContext, isAdmin: boolean): Promise<any> {
        return inTransaction(ctx, async (tx) => {
            const [equb] = await tx`
                SELECT id, name, status, total_rounds, current_round
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
                SELECT id, status FROM memberships WHERE user_id = ${userId} AND equb_id = ${equbId}
            `;

            if (existing.length > 0) {
                const status = existing[0].status as MembershipStatus;
                if (status === 'approved') {
                    return { success: false, error: 'ALREADY_MEMBER', message: 'You are already a member of this Equb' };
                }
                if (status === 'pending') {
                    return { success: false, error: 'ALREADY_PENDING', message: 'Your join request is already awaiting admin approval' };
                }
                // Rejected before — allow the member to re-apply.
                const [updated] = await tx`
                    UPDATE memberships
                    SET status = 'pending', joined_at = CURRENT_TIMESTAMP
                    WHERE id = ${existing[0].id}
                    RETURNING id, user_id, equb_id, status, joined_at
                `;
                return { success: true, membership: updated, pending: true, equbName: equb.name, message: 'Join request submitted — awaiting admin approval' };
            }

            // Capacity is measured against APPROVED members only; a pending
            // request does not consume a slot.
            const [{ count }] = await tx`
                SELECT COUNT(*)::int AS count FROM memberships
                WHERE equb_id = ${equbId} AND status = 'approved'
            `;
            if (count >= equb.total_rounds) {
                return { success: false, error: 'EQUB_FULL', message: 'This Equb group is full' };
            }

            const [membership] = await tx`
                INSERT INTO memberships (user_id, equb_id, status)
                VALUES (${userId}, ${equbId}, ${isAdmin ? 'approved' : 'pending'})
                RETURNING id, user_id, equb_id, status, joined_at
            `;

            if (isAdmin) {
                return { success: true, membership, pending: false, equbName: equb.name, message: 'Joined Equb successfully' };
            }
            return { success: true, membership, pending: true, equbName: equb.name, message: 'Join request submitted — awaiting admin approval' };
        });
    }

    // ── Equb creation requests (member asks admin) ─────────────────────────────

    async createCreationRequest(input: CreateRequestInput, requesterId: string): Promise<any> {
        const sql = getPool();
        const [request] = await sql`
            INSERT INTO equb_creation_requests
                (requester_id, name, description, contribution_amount, cycle_days, total_rounds)
            VALUES
                (${requesterId}, ${input.name}, ${input.description ?? null}, ${input.contribution_amount}, ${input.cycle_days}, ${input.total_rounds})
            RETURNING id, requester_id, name, description, contribution_amount, cycle_days, total_rounds, status, created_at
        `;
        return request;
    }

    async listMyCreationRequests(requesterId: string): Promise<any[]> {
        const sql = getPool();
        return sql`
            SELECT id, requester_id, name, description, contribution_amount, cycle_days,
                   total_rounds, status, admin_notes, reviewed_at, created_at
            FROM equb_creation_requests
            WHERE requester_id = ${requesterId}
            ORDER BY created_at DESC
        `;
    }

    async listPendingCreationRequests(adminId: string): Promise<any[]> {
        return withAdminContext(adminId, async (tx) => {
            return tx`
                SELECT
                    r.id, r.requester_id, r.name, r.description,
                    r.contribution_amount, r.cycle_days, r.total_rounds,
                    r.status, r.admin_notes, r.created_at,
                    u.first_name AS requester_first_name,
                    u.last_name  AS requester_last_name,
                    u.phone      AS requester_phone,
                    u.email      AS requester_email
                FROM equb_creation_requests r
                JOIN users u ON u.id = r.requester_id
                WHERE r.status = 'pending'
                ORDER BY r.created_at ASC
            `;
        });
    }

    /**
     * Approves a creation request:
     *  - creates the Equb with the admin as host (system-hosted),
     *  - adds the admin (host) as an approved member,
     *  - auto-approves the requesting member into the Equb,
     *  - marks the request approved.
     */
    async approveCreationRequest(requestId: string, adminId: string): Promise<any> {
        return withAdminContext(adminId, async (tx) => {
            const [request] = await tx`
                SELECT id, requester_id, name, description, contribution_amount, cycle_days, total_rounds, status
                FROM equb_creation_requests
                WHERE id = ${requestId}
                FOR UPDATE
            `;
            if (!request) {
                return { success: false, error: 'REQUEST_NOT_FOUND', message: 'Creation request not found' };
            }
            if (request.status !== 'pending') {
                return { success: false, error: 'REQUEST_REVIEWED', message: `This request was already ${request.status}` };
            }

            const [equb] = await tx`
                INSERT INTO equb_groups
                    (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds)
                VALUES
                    (${adminId}, ${request.name}, ${request.description}, ${request.contribution_amount * request.total_rounds}, ${request.contribution_amount}, ${request.cycle_days}, ${request.total_rounds})
                RETURNING id, host_id, name, total_amount, contribution_amount, cycle_days, total_rounds, current_round, status, created_at
            `;

            // Host (admin) is automatically a member.
            await tx`
                INSERT INTO memberships (user_id, equb_id, status)
                VALUES (${adminId}, ${equb.id}, 'approved')
                ON CONFLICT (user_id, equb_id) DO NOTHING
            `;
            // The requesting member is approved into the circle they asked for.
            await tx`
                INSERT INTO memberships (user_id, equb_id, status)
                VALUES (${request.requester_id}, ${equb.id}, 'approved')
                ON CONFLICT (user_id, equb_id) DO UPDATE SET status = 'approved'
            `;

            await tx`
                UPDATE equb_creation_requests
                SET status = 'approved', reviewed_by = ${adminId}, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ${requestId}
            `;

            return { success: true, equb, requestId, requesterId: request.requester_id };
        });
    }

    async rejectCreationRequest(requestId: string, adminId: string, notes?: string): Promise<any> {
        return withAdminContext(adminId, async (tx) => {
            const rows = await tx`
                UPDATE equb_creation_requests
                SET status = 'rejected',
                    admin_notes = ${notes ?? null},
                    reviewed_by = ${adminId},
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ${requestId} AND status = 'pending'
                RETURNING id, requester_id, status, admin_notes, name
            `;
            if (rows.length === 0) {
                const [existing] = await tx`SELECT id FROM equb_creation_requests WHERE id = ${requestId}`;
                if (!existing) {
                    return { success: false, error: 'REQUEST_NOT_FOUND', message: 'Creation request not found' };
                }
                return { success: false, error: 'REQUEST_REVIEWED', message: 'This request was already reviewed' };
            }
            return { success: true, request: rows[0] };
        });
    }

    // ── Membership approvals ───────────────────────────────────────────────────

    async listPendingJoinRequests(adminId: string): Promise<any[]> {
        return withAdminContext(adminId, async (tx) => {
            return tx`
                SELECT
                    m.id, m.user_id, m.equb_id, m.status, m.joined_at,
                    u.first_name AS user_first_name,
                    u.last_name  AS user_last_name,
                    u.phone      AS user_phone,
                    u.email      AS user_email,
                    e.name       AS equb_name,
                    e.contribution_amount AS equb_contribution,
                    e.total_rounds        AS equb_total_rounds
                FROM memberships m
                JOIN users u ON u.id = m.user_id
                JOIN equb_groups e ON e.id = m.equb_id
                WHERE m.status = 'pending'
                ORDER BY m.joined_at ASC
            `;
        });
    }

    async approveMembership(membershipId: string, adminId: string): Promise<any> {
        return withAdminContext(adminId, async (tx) => {
            const rows = await tx`
                UPDATE memberships m
                SET status = 'approved'
                WHERE m.id = ${membershipId} AND m.status = 'pending'
                RETURNING
                    m.id, m.user_id, m.equb_id, m.status,
                    (SELECT e.name FROM equb_groups e WHERE e.id = m.equb_id) AS equb_name
            `;
            if (rows.length === 0) {
                const [existing] = await tx`SELECT id FROM memberships WHERE id = ${membershipId}`;
                if (!existing) {
                    return { success: false, error: 'MEMBERSHIP_NOT_FOUND', message: 'Membership request not found' };
                }
                return { success: false, error: 'MEMBERSHIP_REVIEWED', message: 'This membership was already reviewed' };
            }
            return { success: true, membership: rows[0] };
        });
    }

    async rejectMembership(membershipId: string, adminId: string): Promise<any> {
        return withAdminContext(adminId, async (tx) => {
            const rows = await tx`
                UPDATE memberships m
                SET status = 'rejected'
                WHERE m.id = ${membershipId} AND m.status = 'pending'
                RETURNING
                    m.id, m.user_id, m.equb_id, m.status,
                    (SELECT e.name FROM equb_groups e WHERE e.id = m.equb_id) AS equb_name
            `;
            if (rows.length === 0) {
                const [existing] = await tx`SELECT id FROM memberships WHERE id = ${membershipId}`;
                if (!existing) {
                    return { success: false, error: 'MEMBERSHIP_NOT_FOUND', message: 'Membership request not found' };
                }
                return { success: false, error: 'MEMBERSHIP_REVIEWED', message: 'This membership was already reviewed' };
            }
            return { success: true, membership: rows[0] };
        });
    }
}
