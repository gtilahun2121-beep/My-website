import { Injectable } from '@nestjs/common';
import { withAdminContext } from '../../config/database.config';

export interface AdminWalletRow {
    id: string;
    user_id: string;
    balance: string;
    currency: string;
    updated_at: Date | null;
    user_first_name: string;
    user_last_name: string;
    user_phone: string;
    user_email: string;
}

export interface AdminSystemLogRow {
    id: string;
    table_name: string;
    action: string;
    row_id: string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    performed_by: string | null;
    performed_by_name: string | null;
    performed_at: Date;
}

export interface AdminOpsListOptions {
    adminId: string;
    page: number;
    limit: number;
    search?: string;
    table?: string;
    action?: string;
}

/**
 * Read-only admin queries for the Operations console: wallet ledger,
 * equb registry and security audit log.
 */
@Injectable()
export class AdminOperationsRepository {
    async listWallets(opts: AdminOpsListOptions) {
        const { adminId, page, limit, search } = opts;
        const offset = (page - 1) * limit;
        const where: string[] = [];
        const params: any[] = [];
        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            const n = params.length;
            where.push(
                `(LOWER(u.first_name) LIKE $${n} OR LOWER(u.last_name) LIKE $${n} ` +
                `OR LOWER(u.phone) LIKE $${n} OR LOWER(u.email) LIKE $${n})`,
            );
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        return withAdminContext(adminId, async (sql) => {
            params.push(limit);
            const limitN = params.length;
            params.push(offset);
            const offsetN = params.length;

            const items = await sql.unsafe<AdminWalletRow[]>(`
                SELECT
                    w.id,
                    w.user_id,
                    w.balance::text AS balance,
                    w.currency,
                    w.updated_at,
                    u.first_name AS user_first_name,
                    u.last_name  AS user_last_name,
                    u.phone      AS user_phone,
                    u.email      AS user_email
                FROM wallets w
                JOIN users u ON u.id = w.user_id
                ${whereSql}
                ORDER BY w.balance DESC
                LIMIT $${limitN} OFFSET $${offsetN}
            `, params);

            const totalRows = await sql.unsafe<{ count: number }[]>(
                `SELECT COUNT(*)::int AS count FROM wallets w JOIN users u ON u.id = w.user_id ${whereSql}`,
                params.slice(0, params.length - 2),
            );

            return { items, total: totalRows[0]?.count ?? 0, page, limit };
        });
    }

    async listEqubs(opts: { adminId: string; page: number; limit: number; search?: string }) {
        const { adminId, page, limit, search } = opts;
        const offset = (page - 1) * limit;
        const where: string[] = [];
        const params: any[] = [];
        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            const n = params.length;
            where.push(`(LOWER(e.name) LIKE $${n} OR LOWER(h.first_name) LIKE $${n} OR LOWER(h.last_name) LIKE $${n})`);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        return withAdminContext(adminId, async (sql) => {
            params.push(limit);
            const limitN = params.length;
            params.push(offset);
            const offsetN = params.length;

            const items = await sql.unsafe<Record<string, any>[]>(`
                SELECT
                    e.id,
                    e.host_id,
                    e.name,
                    e.description,
                    e.total_amount::text AS total_amount,
                    e.contribution_amount::text AS contribution_amount,
                    e.cycle_days,
                    e.total_rounds,
                    e.current_round,
                    e.status,
                    e.social_fund_balance::text AS social_fund_balance,
                    e.created_at,
                    e.updated_at,
                    h.first_name AS host_first_name,
                    h.last_name  AS host_last_name,
                    h.phone      AS host_phone,
                    (SELECT COUNT(*)::int FROM memberships m
                        WHERE m.equb_id = e.id AND m.status = 'approved') AS member_count
                FROM equb_groups e
                JOIN users h ON h.id = e.host_id
                ${whereSql}
                ORDER BY e.created_at DESC
                LIMIT $${limitN} OFFSET $${offsetN}
            `, params);

            const totalRows = await sql.unsafe<{ count: number }[]>(
                `SELECT COUNT(*)::int AS count FROM equb_groups e JOIN users h ON h.id = e.host_id ${whereSql}`,
                params.slice(0, params.length - 2),
            );

            return { items, total: totalRows[0]?.count ?? 0, page, limit };
        });
    }

    async listSystemLogs(opts: AdminOpsListOptions) {
        const { adminId, page, limit, table, action } = opts;
        const offset = (page - 1) * limit;
        const where: string[] = [];
        const params: any[] = [];
        if (table && table.trim()) {
            params.push(table.trim());
            where.push(`a.table_name = $${params.length}`);
        }
        if (action && action.trim()) {
            params.push(action.trim().toUpperCase());
            where.push(`UPPER(a.action) = $${params.length}`);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        return withAdminContext(adminId, async (sql) => {
            params.push(limit);
            const limitN = params.length;
            params.push(offset);
            const offsetN = params.length;

            const items = await sql.unsafe<AdminSystemLogRow[]>(`
                SELECT
                    a.id,
                    a.table_name,
                    a.action,
                    a.row_id,
                    a.old_values,
                    a.new_values,
                    a.performed_by,
                    u.first_name || ' ' || u.last_name AS performed_by_name,
                    a.performed_at
                FROM audit_logs a
                LEFT JOIN users u ON u.id = a.performed_by
                ${whereSql}
                ORDER BY a.performed_at DESC
                LIMIT $${limitN} OFFSET $${offsetN}
            `, params);

            const totalRows = await sql.unsafe<{ count: number }[]>(
                `SELECT COUNT(*)::int AS count FROM audit_logs a ${whereSql}`,
                params.slice(0, params.length - 2),
            );

            return { items, total: totalRows[0]?.count ?? 0, page, limit };
        });
    }
}