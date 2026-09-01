-- =========================================================================
-- QALNET MIGRATION 012 - TIER 3 PRODUCTION MONEY MOVEMENT
--
-- Brings the schema in line with the Tier 3 recommendation:
--   A. Collection      — payments get a `provider` column (chapa/telebirr/wallet)
--   B. Disbursement    — payouts get the full state machine
--                        PENDING→QUEUED→PROCESSING→SUCCESS | FAILED→RETRY|MANUAL_REVIEW
--   C. Reconciliation  — nightly QAL↔gateway comparison (missing/duplicate/
--                        failed/unmatched/amount_mismatch)
--   D. Idempotent webhooks — webhook_events dedup table
--   E. Payout batches  — payout_batch_runs aggregator + batch_run_id on lines
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block.
-- Run this file statement-by-statement (psql default behaviour).
-- Every statement is guarded so the migration is idempotent and safe to re-run.
-- =========================================================================

-- ── A. Payments: track the collection provider ────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50);

-- ── B. Payout state machine (new states) ──────────────────────────────────
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'success';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'retry';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'manual_review';

-- Payouts: provider, references and failure tracking (Tier 3 recommendation)
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS provider             VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(150),
  ADD COLUMN IF NOT EXISTS requested_at         TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failure_reason       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_payouts_status
  ON payouts (status);

-- ── D. Webhook idempotency ledger ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     VARCHAR(50) NOT NULL,
  tx_ref       VARCHAR(150) NOT NULL,
  status       VARCHAR(20) NOT NULL,
  payload      JSONB       NOT NULL,
  processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, tx_ref, status)
);

-- ── E. Payout batch aggregator ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_batch_runs (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     VARCHAR(50)    NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0.00),
  total_payouts INTEGER       NOT NULL DEFAULT 0 CHECK (total_payouts >= 0),
  status       VARCHAR(20)    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'queued', 'processing', 'success', 'failed')),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE payout_batches
  ADD COLUMN IF NOT EXISTS batch_run_id UUID REFERENCES payout_batch_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payout_batches_run ON payout_batches (batch_run_id);

-- ── C. Reconciliation runs + issues ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date            DATE        NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  missing_count       INTEGER     NOT NULL DEFAULT 0,
  duplicate_count     INTEGER     NOT NULL DEFAULT 0,
  failed_count        INTEGER     NOT NULL DEFAULT 0,
  unmatched_count     INTEGER     NOT NULL DEFAULT 0,
  amount_mismatch_count INTEGER   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at        TIMESTAMP WITH TIME ZONE,
  UNIQUE (run_date)
);

CREATE TABLE IF NOT EXISTS reconciliation_issues (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID           NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  issue_type            VARCHAR(30)    NOT NULL
                          CHECK (issue_type IN ('missing', 'duplicate', 'failed', 'unmatched', 'amount_mismatch')),
  transaction_reference VARCHAR(150),
  provider              VARCHAR(50),
  expected_amount       NUMERIC(15, 2),
  actual_amount         NUMERIC(15, 2),
  details               JSONB          NOT NULL DEFAULT '{}',
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_run
  ON reconciliation_issues (run_id);