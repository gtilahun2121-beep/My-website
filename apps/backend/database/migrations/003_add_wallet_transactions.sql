-- =========================================================================
-- QALNET MIGRATION 003 — WALLET TRANSACTION LEDGER
-- Persists deposits and withdrawals so the wallet page always renders
-- real database rows instead of frontend-only in-memory state.
-- =========================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction     VARCHAR(20)    NOT NULL CHECK (direction IN ('deposit', 'withdrawal')),
  amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  reference     VARCHAR(150)   UNIQUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user
  ON wallet_transactions (user_id, created_at DESC);
