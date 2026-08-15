import { Injectable } from '@nestjs/common';
import { getPool, withAdminContext } from '../../config/database.config';

export interface CustomerRow {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    telegram_handle: string | null;
    profile_photo: string | null;
    role: 'participant' | 'host' | 'admin';
    is_active: boolean;
    verification_status: 'pending' | 'verified' | 'rejected';
    created_at: Date;
}

export interface CustomerSummary {
    total: number;
    active: number;
    hosts: number;
    new_this_month: number;
}

export interface ListCustomersOptions {
    adminId: string;
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: 'active' | 'inactive';
    kyc?: 'pending' | 'verified' | 'rejected';
}

@Injectable()
export class UsersRepository {
    /**
     * Lists registered customers (all users) with pagination, search, and filters.
     * Admin-only — runs inside an admin RLS context so the `users` isolation
     * policy (which allows reads when current_user_role() = 'admin') is satisfied.
     * Returns a safe projection: never exposes password_hash or fayda_id.
     */
    async listCustomers(opts: ListCustomersOptions) {
        const { adminId, page, limit, search, role, status, kyc } = opts;
        const offset = (page - 1) * limit;

        const where: string[] = [];
        const params: any[] = [];

        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            const n = params.length;
            where.push(
                `(LOWER(first_name) LIKE $${n} OR LOWER(last_name) LIKE $${n} ` +
                `OR LOWER(phone) LIKE $${n} OR LOWER(email) LIKE $${n})`,
            );
        }
        if (role) {
            params.push(role);
            where.push(`role = $${params.length}::user_role`);
        }
        if (status === 'active') {
            where.push('is_active = TRUE');
        } else if (status === 'inactive') {
            where.push('is_active = FALSE');
        }
        if (kyc) {
            params.push(kyc);
            where.push(`verification_status = $${params.length}::verification_status`);
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        return withAdminContext(adminId, async (sql) => {
            params.push(limit);
            const limitN = params.length;
            params.push(offset);
            const offsetN = params.length;

            const items = await sql.unsafe<CustomerRow[]>(`
                SELECT id, first_name, last_name, phone, email, telegram_handle,
                       profile_photo, role, is_active, verification_status, created_at
                FROM users
                ${whereSql}
                ORDER BY created_at DESC
                LIMIT $${limitN} OFFSET $${offsetN}
            `, params);

            const totalRows = await sql.unsafe<{ count: number }[]>(
                `SELECT COUNT(*)::int AS count FROM users ${whereSql}`,
                params.slice(0, params.length - 2),
            );

            const summaryRows = await sql.unsafe<CustomerSummary[]>(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE is_active)::int AS active,
                    COUNT(*) FILTER (WHERE role IN ('host', 'admin'))::int AS hosts,
                    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP))::int AS new_this_month
                FROM users
            `);

            return {
                items,
                total: totalRows[0]?.count ?? 0,
                page,
                limit,
                summary: summaryRows[0] ?? { total: 0, active: 0, hosts: 0, new_this_month: 0 },
            };
        });
    }

    async findById(id: string) {
        const sql = getPool();
        const rows = await sql`
            SELECT id, first_name, last_name, phone, email, telegram_handle, profile_photo, role, is_active, verification_status, created_at
            FROM users WHERE id = ${id}
        `;
        return rows[0];
    }

    async update(id: string, data: any) {
        const sql = getPool();
        const allowed = ['first_name', 'last_name', 'phone', 'email', 'telegram_handle', 'profile_photo'];
        const sets: string[] = [];
        const values: any[] = [];

        for (const key of allowed) {
            if (data[key] !== undefined) {
                values.push(data[key]);
                sets.push(`${key} = $${values.length}`);
            }
        }

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const rows = await sql.unsafe(`
            UPDATE users
            SET ${sets.join(', ')}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING id, first_name, last_name, phone, email, telegram_handle, profile_photo, role, is_active, verification_status, created_at
        `, values);
        return rows[0];
    }

    /**
     * Admin reset of a user's PIN. Replaces the password hash AND clears the
     * whole login-lockout state so a permanently blocked account is unblocked.
     * Runs inside an admin RLS context (users UPDATE policy requires
     * current_user_role() = 'admin').
     */
    async resetPinAndUnlock(adminId: string, userId: string, passwordHash: string) {
        return withAdminContext(adminId, async (sql) => {
            const rows = await sql`
                UPDATE users
                SET password_hash         = ${passwordHash},
                    failed_login_attempts = 0,
                    lockout_stage         = 0,
                    locked_until          = NULL,
                    updated_at            = NOW()
                WHERE id = ${userId}
                RETURNING id, first_name, last_name, phone, email, role, is_active, created_at
            `;
            return rows[0] ?? null;
        });
    }

    /**
     * Admin grants or revokes a role for a registered user. This is how the
     * database owner promotes a member to website admin (or demotes them).
     * Runs inside an admin RLS context (users UPDATE policy requires
     * current_user_role() = 'admin').
     */
    async setUserRole(adminId: string, userId: string, role: string) {
        return withAdminContext(adminId, async (sql) => {
            const rows = await sql`
                UPDATE users
                SET role       = ${role}::user_role,
                    updated_at = NOW()
                WHERE id = ${userId}
                RETURNING id, first_name, last_name, phone, email, role, is_active, created_at
            `;
            return rows[0] ?? null;
        });
    }

    /**
     * Admin reviews a member's KYC submission and sets the verification
     * state. Runs inside an admin RLS context so the users UPDATE policy
     * (which requires current_user_role() = 'admin') is satisfied.
     */
    async setKycStatus(adminId: string, userId: string, status: 'verified' | 'rejected') {
        return withAdminContext(adminId, async (sql) => {
            const rows = await sql`
                UPDATE users
                SET verification_status = ${status}::verification_status,
                    verified_at         = CASE
                                            WHEN ${status} = 'verified' THEN NOW()
                                            ELSE NULL
                                          END,
                    updated_at          = NOW()
                WHERE id = ${userId}
                RETURNING id, first_name, last_name, phone, email, role,
                          is_active, verification_status, created_at
            `;
            return rows[0] ?? null;
        });
    }
}
