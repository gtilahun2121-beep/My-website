import { Injectable } from '@nestjs/common';
import { withAdminContext } from '../../config/database.config';

export interface FinanceTransactionRow {
    id: string;
    amount: string;
    fee_deducted: string;
    host_commission_deducted: string;
    round_number: number;
    status: string;
    transaction_reference: string | null;
    paid_at: Date | null;
    created_at: Date;
    user_first_name: string;
    user_last_name: string;
    user_phone: string;
    equb_name: string;
}

export interface FinancePayoutRow {
    id: string;
    round_number: number;
    total_pot_amount: string;
    status: string;
    created_at: Date;
    winner_first_name: string;
    winner_last_name: string;
    winner_phone: string;
    equb_name: string;
}

export interface FinanceOverviewRow {
    total_wallet_balance: number;
    wallet_count: number;
    transaction_volume: number;
    successful_payments: number;
    pending_payments: number;
    pending_volume: number;
    failed_payments: number;
    fees_collected: number;
    admin_fees_collected: number;
    payout_volume: number;
    completed_payouts: number;
    pending_withdrawals: number;
    pending_withdrawal_volume: number;
}

export interface ListFinanceOptions {
    adminId: string;
    page: number;
    limit: number;
    status?: string;
    search?: string;
    start?: string;
    end?: string;
}

/**
 * Read-only aggregates that power the Admin Finance console.
 *
 * Every query runs inside an admin RLS context so the isolation policies
 * (SELECT ... current_user_role() = 'admin') are satisfied for the wide
 * cross-table reads the finance screens need.
 */
@Injectable()
export class AdminFinanceRepository {
    async getFinanceOverview(adminId: string): Promise<FinanceOverviewRow> {
        return withAdminContext(adminId, async (sql) => {
            const rows = await sql<FinanceOverviewRow[]>`
                SELECT
                    (SELECT COALESCE(SUM(balance), 0)::numeric FROM wallets)                                          AS total_wallet_balance,
                    (SELECT COUNT(*)::int FROM wallets)                                                              AS wallet_count,
                    (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments
                        WHERE payment_status IN ('paid', 'auto_debited'))                                            AS transaction_volume,
                    (SELECT COUNT(*)::int FROM payments
                        WHERE payment_status IN ('paid', 'auto_debited'))                                            AS successful_payments,
                    (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'pending')                            AS pending_payments,
                    (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments
                        WHERE payment_status = 'pending')                                                            AS pending_volume,
                    (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'failed')                             AS failed_payments,
                    (SELECT COALESCE(SUM(fee_deducted + host_commission_deducted), 0)::numeric FROM payments
                        WHERE payment_status IN ('paid', 'auto_debited'))                                            AS fees_collected,
                    (SELECT COALESCE(SUM(fee_deducted), 0)::numeric FROM payments
                        WHERE payment_status IN ('paid', 'auto_debited'))                                            AS admin_fees_collected,
                    (SELECT COALESCE(SUM(total_pot_amount), 0)::numeric FROM payouts
                        WHERE status IN ('approved', 'batched', 'completed'))                                        AS payout_volume,
                    (SELECT COUNT(*)::int FROM payouts WHERE status = 'completed')                                   AS completed_payouts,
                    (SELECT COUNT(*)::int FROM payouts WHERE status = 'pending')                                    AS pending_withdrawals,
                    (SELECT COALESCE(SUM(total_pot_amount), 0)::numeric FROM payouts
                        WHERE status = 'pending')                                                                    AS pending_withdrawal_volume
            `;
            return rows[0] ?? {
                total_wallet_balance: 0,
                wallet_count: 0,
                transaction_volume: 0,
                successful_payments: 0,
                pending_payments: 0,
                pending_volume: 0,
                failed_payments: 0,
                fees_collected: 0,
                admin_fees_collected: 0,
                payout_volume: 0,
                completed_payouts: 0,
                pending_withdrawals: 0,
                pending_withdrawal_volume: 0,
            };
        });
    }

    async listTransactions(opts: ListFinanceOptions) {
        const { adminId, page, limit, status, search, start, end } = opts;
        const offset = (page - 1) * limit;

        const where: string[] = [];
        const params: any[] = [];

        if (status) {
            params.push(status);
            where.push(`p.payment_status = $${params.length}::payment_status`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            const n = params.length;
            where.push(
                `(LOWER(u.first_name) LIKE $${n} OR LOWER(u.last_name) LIKE $${n} ` +
                `OR LOWER(u.phone) LIKE $${n} OR LOWER(e.name) LIKE $${n})`,
            );
        }
        if (start) {
            params.push(start);
            where.push(`p.created_at >= $${params.length}::date`);
        }
        if (end) {
            params.push(end);
            where.push(`p.created_at < ($${params.length}::date + 1)`);
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        return withAdminContext(adminId, async (sql) => {
            params.push(limit);
            const limitN = params.length;
            params.push(offset);
            const offsetN = params.length;

            const items = await sql.unsafe<FinanceTransactionRow[]>(`
                SELECT
                    p.id,
                    p.amount::text                      AS amount,
                    p.fee_deducted::text                AS fee_deducted,
                    p.host_commission_deducted::text    AS host_commission_deducted,
                    p.round_number,
                    p.payment_status                    AS status,
                    p.transaction_reference,
                    p.paid_at,
                    p.created_at,
                    u.first_name                        AS user_first_name,
                    u.last_name                         AS user_last_name,
                    u.phone                             AS user_phone,
                    e.name                              AS equb_name
                FROM payments p
                JOIN users u       ON u.id = p.user_id
                JOIN equb_groups e ON e.id = p.equb_id
                ${whereSql}
                ORDER BY p.created_at DESC
                LIMIT $${limitN} OFFSET $${offsetN}
            `, params);

            const totalRows = await sql.unsafe<{ count: number }[]>(
                `SELECT COUNT(*)::int AS count FROM payments p
                 JOIN users u       ON u.id = p.user_id
                 JOIN equb_groups e ON e.id = p.equb_id
                 ${whereSql}`,
                params.slice(0, params.length - 2),
            );

            return { items, total: totalRows[0]?.count ?? 0, page, limit };
        });
    }

    async listPayouts(opts: ListFinanceOptions) {
        const { adminId, page, limit, status } = opts;
        const offset = (page - 1) * limit;

        const where: string[] = [];
        const params: any[] = [];

        if (status) {
            params.push(status);
            where.push(`po.status = $${params.length}::payout_status`);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        return withAdminContext(adminId, async (sql) => {
            params.push(limit);
            const limitN = params.length;
            params.push(offset);
            const offsetN = params.length;

            const items = await sql.unsafe<FinancePayoutRow[]>(`
                SELECT
                    po.id,
                    po.round_number,
                    po.total_pot_amount::text          AS total_pot_amount,
                    po.status,
                    po.created_at,
                    u.first_name                        AS winner_first_name,
                    u.last_name                         AS winner_last_name,
                    u.phone                             AS winner_phone,
                    e.name                              AS equb_name
                FROM payouts po
                JOIN users u       ON u.id = po.winner_id
                JOIN equb_groups e ON e.id = po.equb_id
                ${whereSql}
                ORDER BY po.created_at DESC
                LIMIT $${limitN} OFFSET $${offsetN}
            `, params);

            const totalRows = await sql.unsafe<{ count: number }[]>(
                `SELECT COUNT(*)::int AS count FROM payouts po ${whereSql}`,
                params.slice(0, params.length - 2),
            );

            return { items, total: totalRows[0]?.count ?? 0, page, limit };
        });
    }
}
