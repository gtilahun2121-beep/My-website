-- =========================================================================
-- QALNET MIGRATION 013 — QUERY PERFORMANCE (PAGINATION + MERGE QUERIES)
-- Adds composite indexes that power the hot read paths introduced alongside
-- pagination and the merged wallet-transaction feed:
--
--   * equb discovery / "my equbs"  (created_at ordering)
--   * merged wallet feed           (payments/payouts/wallet_transactions by
--                                   owner, ordered newest-first)
--   * social fund proposals        (per-equb lists)
--
-- Every statement is guarded so this migration is safe to re-run.
-- =========================================================================

-- Equb discovery: ORDER BY created_at DESC on the full list
CREATE INDEX IF NOT EXISTS idx_equb_groups_created
    ON equb_groups (created_at DESC);

-- Merged wallet feed: per-owner payment history, newest first
CREATE INDEX IF NOT EXISTS idx_payments_user_created
    ON payments (user_id, created_at DESC);

-- Merged wallet feed: per-winner payout history, newest first
CREATE INDEX IF NOT EXISTS idx_payouts_winner_created
    ON payouts (winner_id, created_at DESC);

-- Merged wallet feed: per-user wallet ledger, newest first
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created
    ON wallet_transactions (user_id, created_at DESC);

-- Social proposals: per-equb lists filtered by status, newest first
CREATE INDEX IF NOT EXISTS idx_social_proposals_equb_status
    ON social_proposals (equb_id, status, created_at DESC);

-- Social votes: tally lookups by proposal
CREATE INDEX IF NOT EXISTS idx_social_votes_proposal
    ON social_votes (proposal_id);

-- Notifications: "my notifications" list, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);