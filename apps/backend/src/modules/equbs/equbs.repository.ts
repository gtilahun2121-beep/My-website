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
    /** 'lottery' (default) | 'fcfs' | 'auction' — determines how winners are selected */
    winner_selection_type?: 'lottery' | 'fcfs' | 'auction';
    /** 'public' (default) | 'private' | 'corporate' — controls visibility and access */
    equb_type?: 'public' | 'private' | 'corporate';
    /** Whether created from preset template */
    is_preset?: boolean;
    /** Reference to preset template if applicable */
    preset_template_id?: string | null;
    created_at: Date;
}

export interface CreateEqubInput {
    name: string;
    description?: string;
    total_amount: number;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
    /** 'round' (default) | 'daily' | 'weekly' — selects the cycle engine. */
    cycle_type?: 'round' | 'daily' | 'weekly';
    /** Local time each day/week the payment window closes (default '17:00'). */
    payment_cutoff_time?: string;
    /** Fraction of the contribution charged for missing a cutoff (default 0.02). */
    late_penalty_rate?: number;
    /** Weekly mode only: day of week (0=Sun..6=Sat) the weekly draw runs (Day 7). */
    payment_cutoff_weekday?: number;
    /** 'lottery' | 'fcfs' | 'auction' - how winners are selected (default: 'lottery') */
    winner_selection_type?: 'lottery' | 'fcfs' | 'auction';
    /** 'public' | 'private' | 'corporate' - visibility and access control (default: 'public') */
    equb_type?: 'public' | 'private' | 'corporate';
    /** Preset template ID to use as base (if provided, overrides manual config) */
    preset_template_id?: string;
}

export interface CreateRequestInput {
    name: string;
    description?: string;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
}

export type MembershipStatus = 'pending' | 'approved' | 'rejected';

export interface FCFSPaymentOrderRecord {
    id: string;
    equb_id: string;
    round_number: number;
    user_id: string;
    payment_id: string | null;
    paid_at: Date;
    payment_order: number;
}

export interface EqubPresetTemplate {
    id: string;
    name: string;
    description: string | null;
    contribution_amount: number;
    total_rounds: number;
    cycle_days: number;
    cycle_type: 'round' | 'daily' | 'weekly';
    winner_selection: 'lottery' | 'fcfs' | 'auction';
    equb_type: 'public' | 'private' | 'corporate';
    is_featured: boolean;
    display_order: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Clamps a pagination value to a safe integer range so a malformed query
 * string can never request a huge LIMIT/OFFSET.
 */
function clampPaging(value: number, min: number, max: number): number {
    const n = Math.trunc(Number.isFinite(value) ? value : min);
    return Math.min(Math.max(n, min), max);
}

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

    async findAll(limit = 100, offset = 0): Promise<any[]> {
        const sql = getPool();
        const safeLimit = clampPaging(limit, 1, 200);
        const safeOffset = clampPaging(offset, 0, Number.MAX_SAFE_INTEGER);
        return sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.created_at, e.updated_at,
                e.winner_selection_type, e.equb_type, e.is_preset, e.preset_template_id,
                u.first_name AS host_first_name,
                u.last_name  AS host_last_name,
                u.phone      AS host_phone,
                counts.member_count,
                GREATEST(e.total_rounds - counts.member_count, 0) AS open_slots
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS member_count
                FROM memberships m
                WHERE m.equb_id = e.id AND m.status = 'approved'
            ) counts ON TRUE
            WHERE e.equb_type = 'public' OR e.equb_type = 'public'
            ORDER BY e.created_at DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;
    }

    async findById(id: string, userId?: string): Promise<any | null> {
        const sql = getPool();
        const rows = await sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.winner_selection_type, e.equb_type, e.is_preset, e.preset_template_id,
                e.created_at, e.updated_at,
                u.first_name AS host_first_name,
                u.last_name  AS host_last_name,
                u.phone      AS host_phone,
                (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int AS member_count,
                GREATEST(e.total_rounds - (SELECT COUNT(*) FROM memberships m WHERE m.equb_id = e.id AND m.status = 'approved')::int, 0) AS open_slots,
                CASE
                    WHEN ${userId ?? null}::uuid IS NOT NULL THEN (
                        SELECT mm.status FROM memberships mm
                        WHERE mm.equb_id = e.id AND mm.user_id = ${userId ?? null}::uuid
                        LIMIT 1
                    )
                    ELSE NULL
                END AS membership_status,
                (e.host_id = ${userId ?? null}::uuid) AS is_host
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            WHERE e.id = ${id}
            LIMIT 1
        `;
        
        const equb = rows[0] ?? null;
        if (!equb) return null;
        
        // Visibility control: check if user has access to this equb based on type
        const isHost = equb.is_host === true;
        const isMember = equb.membership_status !== null;
        
        if (equb.equb_type === 'private' && !isHost && !isMember) {
            // Private equbs only visible to host and members
            return null;
        }
        
        if (equb.equb_type === 'corporate' && !isHost && !isMember) {
            // Corporate equbs only visible to host and members
            return null;
        }
        
        // Public equbs visible to everyone
        return equb;
    }

    async findMine(userId: string, limit = 100, offset = 0): Promise<any[]> {
        const sql = getPool();
        const safeLimit = clampPaging(limit, 1, 200);
        const safeOffset = clampPaging(offset, 0, Number.MAX_SAFE_INTEGER);
        return sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.winner_selection_type, e.equb_type, e.is_preset, e.preset_template_id,
                e.created_at, e.updated_at,
                u.first_name AS host_first_name,
                u.last_name  AS host_last_name,
                u.phone      AS host_phone,
                counts.member_count,
                GREATEST(e.total_rounds - counts.member_count, 0) AS open_slots,
                (e.host_id = ${userId}) AS is_host,
                ms.status AS membership_status
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS member_count
                FROM memberships m
                WHERE m.equb_id = e.id AND m.status = 'approved'
            ) counts ON TRUE
            LEFT JOIN LATERAL (
                SELECT mm.status FROM memberships mm
                WHERE mm.equb_id = e.id AND mm.user_id = ${userId}
            ) ms ON TRUE
            WHERE (e.host_id = ${userId} OR EXISTS (
                SELECT 1 FROM memberships m
                WHERE m.equb_id = e.id AND m.user_id = ${userId} AND m.status IN ('approved', 'pending')
            ))
            ORDER BY e.created_at DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;
    }

    // ── Create (admin only — enforced by RolesGuard at the controller) ─────────

    async create(input: CreateEqubInput, hostId: string, ctx: RlsContext): Promise<any> {
        return inTransaction(ctx, async (tx) => {
            const cycleType = input.cycle_type ?? 'round';
            const [equb] = await tx`
                INSERT INTO equb_groups
                    (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds,
                     cycle_type, payment_cutoff_time, late_penalty_rate, payment_cutoff_weekday)
                VALUES
                    (${hostId}, ${input.name}, ${input.description ?? null}, ${input.total_amount}, ${input.contribution_amount}, ${input.cycle_days}, ${input.total_rounds},
                     ${cycleType}, ${input.payment_cutoff_time ?? '17:00'}, ${input.late_penalty_rate ?? 0.02}, ${input.payment_cutoff_weekday ?? 6})
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

    // ── Activate ────────────────────────────────────────────────────────────────

    /**
     * Starts the Equb's first round: flips an 'open' equb to 'active' and
     * sets current_round to 1. Idempotent — returns an explicit error when
     * the equb is not in the 'open' state (already active/completed/cancelled).
     * Only the host or an admin may activate (role enforced at the controller).
     */
    async activateEqub(equbId: string, ctx: RlsContext): Promise<any> {
        return inTransaction(ctx, async (tx) => {
            const rows = await tx`
                UPDATE equb_groups
                SET status       = 'active',
                    current_round = 1,
                    updated_at   = NOW()
                WHERE id = ${equbId}
                  AND status = 'open'
                  AND current_round = 0
                RETURNING
                    id, host_id, name, description, telegram_group_id,
                    total_amount, contribution_amount, cycle_days,
                    total_rounds, current_round, status, social_fund_balance,
                    created_at, updated_at
            `;

            if (rows.length > 0) {
                return { success: true, equb: rows[0] };
            }

            const [existing] = await tx`
                SELECT id, status, current_round
                FROM equb_groups
                WHERE id = ${equbId}
            `;
            if (!existing) {
                return { success: false, error: 'EQUB_NOT_FOUND', message: 'Equb not found' };
            }
            return {
                success: false,
                error: 'EQUB_ALREADY_STARTED',
                message: `This Equb is already ${existing.status}.`,
            };
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

    // ── Preset Templates ──────────────────────────────────────────────────────

    async getPresetTemplates(): Promise<EqubPresetTemplate[]> {
        const sql = getPool();
        return sql<EqubPresetTemplate[]>`
            SELECT
                id, name, description, contribution_amount, total_rounds, cycle_days,
                cycle_type, winner_selection, equb_type, is_featured, display_order,
                created_at, updated_at
            FROM equb_preset_templates
            WHERE is_featured = TRUE
            ORDER BY display_order ASC, created_at DESC
        `;
    }

    async getPresetTemplate(templateId: string): Promise<EqubPresetTemplate | null> {
        const sql = getPool();
        const rows = await sql<EqubPresetTemplate[]>`
            SELECT
                id, name, description, contribution_amount, total_rounds, cycle_days,
                cycle_type, winner_selection, equb_type, is_featured, display_order,
                created_at, updated_at
            FROM equb_preset_templates
            WHERE id = ${templateId}
        `;
        return rows[0] ?? null;
    }

    // ── FCFS Payment Order Tracking ───────────────────────────────────────────

    async recordFCFSPaymentOrder(
        equbId: string,
        roundNumber: number,
        userId: string,
        paymentId: string,
        paidAt: Date
    ): Promise<FCFSPaymentOrderRecord> {
        const sql = getPool();
        
        // Get the current payment order count to determine this payment's order
        const countResult = await sql<{ count: number }[]>`
            SELECT COUNT(*)::int AS count FROM fcfs_payment_order
            WHERE equb_id = ${equbId} AND round_number = ${roundNumber}
        `;
        
        const paymentOrder = (countResult[0]?.count ?? 0) + 1;
        
        const [record] = await sql<FCFSPaymentOrderRecord[]>`
            INSERT INTO fcfs_payment_order (equb_id, round_number, user_id, payment_id, paid_at, payment_order)
            VALUES (${equbId}, ${roundNumber}, ${userId}, ${paymentId}, ${paidAt}, ${paymentOrder})
            ON CONFLICT (equb_id, round_number, user_id) 
            DO UPDATE SET payment_id = EXCLUDED.payment_id, paid_at = EXCLUDED.paid_at
            RETURNING id, equb_id, round_number, user_id, payment_id, paid_at, payment_order
        `;
        
        return record;
    }

    async getFCFSWinner(equbId: string, roundNumber: number): Promise<{ userId: string; paymentOrder: number } | null> {
        const sql = getPool();
        const rows = await sql<{ user_id: string; payment_order: number }[]>`
            SELECT user_id, payment_order FROM fcfs_payment_order
            WHERE equb_id = ${equbId} AND round_number = ${roundNumber}
            ORDER BY payment_order ASC
            LIMIT 1
        `;
        
        if (rows.length === 0) return null;
        return { userId: rows[0].user_id, paymentOrder: rows[0].payment_order };
    }

    async getFCFSPaymentOrder(equbId: string, roundNumber: number): Promise<FCFSPaymentOrderRecord[]> {
        const sql = getPool();
        return sql<FCFSPaymentOrderRecord[]>`
            SELECT id, equb_id, round_number, user_id, payment_id, paid_at, payment_order
            FROM fcfs_payment_order
            WHERE equb_id = ${equbId} AND round_number = ${roundNumber}
            ORDER BY payment_order ASC
        `;
    }

    async getEqubWinnerSelectionType(equbId: string): Promise<{ winner_selection_type: string } | null> {
        const sql = getPool();
        const rows = await sql<{ winner_selection_type: string }[]>`
            SELECT winner_selection_type FROM equb_groups WHERE id = ${equbId}
        `;
        return rows[0] ?? null;
    }

    /**
     * Get equbs filtered by type (public, private, corporate)
     * Used for discovery pages and filtering
     */
    async findByType(equbType: 'public' | 'private' | 'corporate', userId?: string, limit = 50, offset = 0): Promise<any[]> {
        const sql = getPool();
        const safeLimit = clampPaging(limit, 1, 200);
        const safeOffset = clampPaging(offset, 0, Number.MAX_SAFE_INTEGER);
        
        return sql`
            SELECT
                e.id, e.host_id, e.name, e.description, e.telegram_group_id,
                e.total_amount, e.contribution_amount, e.cycle_days,
                e.total_rounds, e.current_round, e.status, e.social_fund_balance,
                e.winner_selection_type, e.equb_type, e.is_preset, e.preset_template_id,
                e.created_at, e.updated_at,
                u.first_name AS host_first_name,
                u.last_name AS host_last_name,
                u.phone AS host_phone,
                counts.member_count,
                GREATEST(e.total_rounds - counts.member_count, 0) AS open_slots,
                CASE WHEN ${userId ?? null}::uuid = e.host_id THEN TRUE ELSE FALSE END AS is_host,
                CASE WHEN ${userId ?? null}::uuid IS NOT NULL THEN (
                    SELECT mm.status FROM memberships mm
                    WHERE mm.equb_id = e.id AND mm.user_id = ${userId ?? null}::uuid LIMIT 1
                ) ELSE NULL END AS membership_status
            FROM equb_groups e
            JOIN users u ON u.id = e.host_id
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS member_count
                FROM memberships m
                WHERE m.equb_id = e.id AND m.status = 'approved'
            ) counts ON TRUE
            WHERE e.equb_type = ${equbType}
            ORDER BY e.created_at DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;
    }
}
