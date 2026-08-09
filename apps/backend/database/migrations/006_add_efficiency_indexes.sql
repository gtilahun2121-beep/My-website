-- =========================================================================
-- QALNET MIGRATION 006 — QUERY EFFICIENCY INDEXES
-- Covers the most frequent user-facing lookup patterns that were missing
-- from the base schema. Every statement is guarded with an existence check
-- so this migration is safe even if a table is not yet present.
-- =========================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['notifications', 'memberships', 'equb_groups', 'payouts',
                              'payments', 'refresh_tokens', 'lottery_draws', 'audit_logs']
  LOOP
    IF to_regclass(tbl) IS NULL THEN
      RAISE NOTICE 'skipping % (table not present)', tbl;
    END IF;
  END LOOP;
END $$;

-- Notifications: unread badge counts per user (dashboard + header badge)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- Memberships: "my equbs" list by user
CREATE INDEX IF NOT EXISTS idx_memberships_user
  ON memberships (user_id);

-- Equb groups: host's group list + discovery by status
CREATE INDEX IF NOT EXISTS idx_equb_groups_host_status
  ON equb_groups (host_id, status);

-- Payouts: per-equb payout history + status filter
CREATE INDEX IF NOT EXISTS idx_payouts_equb_status
  ON payouts (equb_id, status);

-- Payments: per-equb outstanding balance rollups
CREATE INDEX IF NOT EXISTS idx_payments_equb_status
  ON payments (equb_id, payment_status);

-- Refresh tokens: periodic expiry sweeps
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry
  ON refresh_tokens (expires_at);

-- Lottery draws: per-equb draw history
CREATE INDEX IF NOT EXISTS idx_lottery_draws_equb
  ON lottery_draws (equb_id);

-- Audit trail: lookups by affected row, newest first
CREATE INDEX IF NOT EXISTS idx_audit_logs_row
  ON audit_logs (row_id, performed_at DESC);
