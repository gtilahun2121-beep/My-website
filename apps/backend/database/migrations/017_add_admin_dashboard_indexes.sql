-- =========================================================================
-- QALNET MIGRATION 017 — ADMIN DASHBOARD AGGREGATION INDEXES
--
-- Speeds up the hot read path used by GET /api/v1/admin/stats:
--
--   * KPI block: date-range and status filter counts over users/payments
--   * activity trend: per-day GROUP BY aggregations over a date range
--   * recent transactions: latest payments first (joined with users/equbs)
--   * top equbs: group membership counts
--
-- Every statement is guarded so this migration is safe to re-run.
-- =========================================================================

-- Latest payments first (dashboard "Recent transactions" feed)
CREATE INDEX IF NOT EXISTS idx_payments_created_desc
    ON payments (created_at DESC);

-- Trend + KPI counts: payments grouped by day/status within a date range.
-- A leading payment_status, then created_at, lets Postgres satisfy both
-- "WHERE payment_status = X" and day-range GROUP BY scans from one index.
CREATE INDEX IF NOT EXISTS idx_payments_status_created
    ON payments (payment_status, created_at);

-- Trend + KPI counts over users by created_at (day-range GROUP BY)
CREATE INDEX IF NOT EXISTS idx_users_created
    ON users (created_at);

-- Trend aggregation for equb_groups by created_at
CREATE INDEX IF NOT EXISTS idx_equb_groups_created_asc
    ON equb_groups (created_at);

-- Trend aggregation for memberships by joined_at
CREATE INDEX IF NOT EXISTS idx_memberships_joined
    ON memberships (joined_at);

-- Top equbs: membership count per equb (LEFT JOIN + GROUP BY)
CREATE INDEX IF NOT EXISTS idx_memberships_equb_status
    ON memberships (equb_id, status);

-- Payouts KPI: pending count and payout-volume SUM by status
CREATE INDEX IF NOT EXISTS idx_payouts_status
    ON payouts (status);

-- Wallet aggregate SUM(balance)
CREATE INDEX IF NOT EXISTS idx_wallets_balance
    ON wallets (balance);
