import { Injectable } from '@nestjs/common';
import { withAdminContext } from '../../config/database.config';

/**
 * Read-only aggregates that power the Admin dashboard.
 *
 * Every query runs inside an admin RLS context so the isolation policies
 * (SELECT ... current_user_role() = 'admin') are satisfied for the wide
 * cross-table reads the dashboard needs.
 */
@Injectable()
export class AdminStatsRepository {
    async getDashboardStats(
        adminId: string,
        window: { days?: number; start?: string; end?: string } = {},
    ) {
        return withAdminContext(adminId, async (sql) => {
            const lowerBound = window.start
                ? sql`${window.start}::date`
                : sql`CURRENT_DATE - make_interval(days => ${window.days ?? 30})`;
            const upperBound = window.end
                ? sql`${window.end}::date`
                : sql`CURRENT_DATE`;
            const upperExclusive = window.end
                ? sql`${window.end}::date + 1`
                : sql`CURRENT_DATE + 1`;
            const [kpis] = await sql`
                SELECT
                    (SELECT COUNT(*)::int                FROM users)                        AS total_users,
                    (SELECT COUNT(*)::int                FROM users WHERE is_active)         AS active_users,
                    (SELECT COUNT(*)::int                FROM users WHERE role IN ('host','admin')) AS hosts,
                    (SELECT COUNT(*)::int                FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS new_users_this_month,
                    (SELECT COUNT(*)::int                FROM equb_groups)                   AS total_equbs,
                    (SELECT COUNT(*)::int                FROM equb_groups WHERE status = 'open') AS active_equbs,
                    (SELECT COUNT(*)::int                FROM memberships)                   AS total_memberships,
                    (SELECT COALESCE(SUM(balance),0)::numeric          FROM wallets)         AS total_wallet_balance,
                    (SELECT COUNT(*)::int                FROM payments WHERE payment_status IN ('paid','auto_debited')) AS successful_payments,
                    (SELECT COUNT(*)::int                FROM payments WHERE payment_status = 'pending') AS pending_payments,
                    (SELECT COUNT(*)::int                FROM payments WHERE payment_status = 'failed')   AS failed_transactions,
                    (SELECT COUNT(*)::int                FROM payouts   WHERE status = 'pending')        AS pending_withdrawals,
                    (SELECT COALESCE(SUM(total_pot_amount),0)::numeric FROM payouts WHERE status IN ('approved','batched','completed')) AS total_payout_volume,
                    (SELECT COUNT(*)::int                FROM equb_groups WHERE status IN ('open','active')) AS operational_equbs
            `;

            const trend = await sql`
                SELECT
                    to_char(day, 'YYYY-MM-DD')                          AS date,
                    COALESCE(SUM(cnt), 0)::int                          AS count,
                    COALESCE(SUM(cnt) FILTER (WHERE kind = 'registrations'), 0)::int AS registrations,
                    COALESCE(SUM(cnt) FILTER (WHERE kind = 'payments'), 0)::int      AS payments,
                    COALESCE(SUM(cnt) FILTER (WHERE kind = 'equbs'), 0)::int         AS equbs,
                    COALESCE(SUM(cnt) FILTER (WHERE kind = 'joins'), 0)::int         AS joins
                FROM generate_series(
                    ${lowerBound},
                    ${upperBound},
                    '1 day'
                ) AS day
                LEFT JOIN (
                    SELECT u.created_at::date AS d, 'registrations' AS kind, COUNT(*)::int AS cnt
                    FROM users u
                    WHERE u.created_at >= ${lowerBound}
                      AND u.created_at < ${upperExclusive}
                    GROUP BY 1
                    UNION ALL
                    SELECT p.created_at::date AS d, 'payments' AS kind, COUNT(*)::int AS cnt
                    FROM payments p
                    WHERE p.payment_status IN ('paid', 'auto_debited')
                      AND p.created_at >= ${lowerBound}
                      AND p.created_at < ${upperExclusive}
                    GROUP BY 1
                    UNION ALL
                    SELECT e.created_at::date AS d, 'equbs' AS kind, COUNT(*)::int AS cnt
                    FROM equb_groups e
                    WHERE e.created_at >= ${lowerBound}
                      AND e.created_at < ${upperExclusive}
                    GROUP BY 1
                    UNION ALL
                    SELECT m.joined_at::date AS d, 'joins' AS kind, COUNT(*)::int AS cnt
                    FROM memberships m
                    WHERE m.status IN ('approved', 'pending')
                      AND m.joined_at >= ${lowerBound}
                      AND m.joined_at < ${upperExclusive}
                    GROUP BY 1
                ) s ON s.d = day
                GROUP BY day
                ORDER BY day
            `;

            const recentTransactions = await sql`
                SELECT
                    p.id,
                    p.amount::text          AS amount,
                    p.payment_status        AS status,
                    p.round_number,
                    p.paid_at,
                    p.created_at,
                    u.first_name            AS user_first_name,
                    u.last_name             AS user_last_name,
                    u.phone                 AS user_phone,
                    e.name                  AS equb_name
                FROM payments p
                JOIN users u       ON u.id = p.user_id
                JOIN equb_groups e ON e.id = p.equb_id
                ORDER BY p.created_at DESC
                LIMIT 8
            `;

            const topEqubs = await sql`
                SELECT
                    e.id,
                    e.name,
                    e.total_amount::text         AS total_amount,
                    e.contribution_amount::text  AS contribution_amount,
                    e.current_round,
                    e.total_rounds,
                    e.status,
                    e.created_at,
                    COUNT(m.id)::int AS member_count
                FROM equb_groups e
                LEFT JOIN memberships m ON m.equb_id = e.id
                GROUP BY e.id
                ORDER BY member_count DESC, e.created_at DESC
                LIMIT 5
            `;

            return { kpis, trend, recent_transactions: recentTransactions, top_equbs: topEqubs };
        });
    }
}
