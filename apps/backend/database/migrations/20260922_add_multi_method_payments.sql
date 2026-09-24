-- =========================================================================
-- QALNET MIGRATION 20260922 - MULTI-METHOD PAYMENTS
--
--   A. Additive columns on `payments` for the multi-method payment flow.
--      The canonical columns (payment_status / transaction_reference /
--      provider) are left untouched — existing flows keep working.
--   B. `wallet_transfers` ledger for wallet-to-wallet transfers (used by the
--      wallet payment method).
--
-- Every statement is guarded so the migration is idempotent and safe to
-- re-run against an already-migrated database.
-- =========================================================================

-- ── A. Payments: enhanced multi-method metadata ───────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method     VARCHAR(50);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(150);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS failure_reason     TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMP WITH TIME ZONE;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS tx_metadata        JSONB;

-- ── B. Wallet-to-wallet transfer ledger ───────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transfers (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user_id    UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  reference     VARCHAR(150)   UNIQUE NOT NULL,
  status        VARCHAR(20)    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'failed')),
  reason        TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_from
  ON wallet_transfers (from_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_to
  ON wallet_transfers (to_user_id, created_at DESC);