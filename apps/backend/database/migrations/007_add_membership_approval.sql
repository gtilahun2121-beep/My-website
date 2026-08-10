-- =========================================================================
-- QALNET MIGRATION 007 - MEMBERSHIP & EQUB CREATION APPROVAL WORKFLOW
--
-- Implements the admin-gated security flow:
--   1. Only admins may create Equbs directly (enforced in the API layer
--      via RolesGuard). Members must submit an equb creation request.
--   2. Members requesting to JOIN an existing Equb are not admitted
--      automatically — they enter a 'pending' state until an admin
--      approves or rejects them.
--   3. equb_creation_requests table holds member requests to start a new
--      Equb. An admin approval creates the Equb (admin hosts it) and
--      auto-approves the requesting member into it.
--
-- Every statement is guarded so this migration is idempotent and safe to
-- re-run.
-- =========================================================================

-- ── 1. memberships.status ──────────────────────────────────────────────────
-- Existing memberships (seed data / host memberships) default to 'approved'
-- so nothing already active is orphaned.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memberships' AND column_name = 'status'
  ) THEN
    ALTER TABLE memberships
      ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memberships_status
  ON memberships (status);

-- ── 2. equb_creation_requests table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equb_creation_requests (
    id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id        UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(100)   NOT NULL,
    description         TEXT,
    contribution_amount NUMERIC(15, 2) NOT NULL CHECK (contribution_amount > 0.00),
    cycle_days          INTEGER        NOT NULL CHECK (cycle_days >= 3),
    total_rounds        INTEGER        NOT NULL CHECK (total_rounds > 0),
    status              TEXT           NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes         TEXT,
    reviewed_by         UUID           REFERENCES users(id),
    reviewed_at         TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equb_creation_requests_status
  ON equb_creation_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_equb_creation_requests_requester
  ON equb_creation_requests (requester_id);
