-- =========================================================================
-- MIGRATION 014 — IMMUTABLE LOTTERY EVENT LEDGER + WINNER STATE TRACKING
--
-- Adds:
--   1. lottery_events — an append-only, immutable ledger of every lottery
--      event (WIN / DRAW_SKIPPED / PAYOUT_SCHEDULED). Rows are INSERT-only;
--      UPDATE and DELETE are blocked by database triggers, so the lottery
--      history can never be silently tampered with.
--   2. equb_groups.won_current_cycle — a per-member flag on the membership
--      denoting whether that member has already won during the CURRENT
--      cycle. The lottery service excludes these members from the spin.
--   3. A partial UNIQUE index preventing a single member from ever being
--      recorded as a lotto winner more than once within the same equb.
--
-- The (equb_id, round_number) pair maps to what the rest of the codebase
-- calls a "cycle" (equb_groups.current_round). We keep that naming to match
-- the existing schema instead of inventing a parallel cycle table.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. equb_groups: track whether each member has already won the active cycle
-- -------------------------------------------------------------------------
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS won_current_cycle BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS won_round_number  INTEGER;

COMMENT ON COLUMN memberships.won_current_cycle IS
  'True once the member wins a lottery round; the service resets it at the start of each new cycle so a member can win once per cycle.';

-- Fast path: find members who have already won the current cycle for a spin.
CREATE INDEX IF NOT EXISTS idx_memberships_cycle_win
  ON memberships (equb_id)
  WHERE won_current_cycle = TRUE;

-- -------------------------------------------------------------------------
-- 2. lottery_events — immutable, append-only lottery ledger
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lottery_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id        UUID        NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  round_number   INTEGER     NOT NULL CHECK (round_number > 0),
  membership_id  UUID        REFERENCES memberships(id) ON DELETE RESTRICT,
  winner_id      UUID        REFERENCES users(id)        ON DELETE RESTRICT,
  event_type     VARCHAR(32) NOT NULL
                   CHECK (event_type IN ('LOTTERY_WIN', 'DRAW_SKIPPED', 'PAYOUT_SCHEDULED')),
  performed_by   UUID        REFERENCES users(id)      ON DELETE SET NULL,
  draw_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata       JSONB,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lottery_events_equb_round
  ON lottery_events (equb_id, round_number);
CREATE INDEX IF NOT EXISTS idx_lottery_events_winner
  ON lottery_events (winner_id);

-- -------------------------------------------------------------------------
-- 3. Database-level duplicate-win protection.
--
-- A member may win at most ONCE per equb. Even if the application layer
-- fails to exclude an existing winner, the database refuses the second
-- LOTTERY_WIN event, causing the whole spin transaction to roll back.
-- -------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_lottery_win_per_member
  ON lottery_events (equb_id, winner_id)
  WHERE event_type = 'LOTTERY_WIN';

-- -------------------------------------------------------------------------
-- Immutability enforcement: lottery_events is append-only.
-- Application code can INSERT but may never UPDATE or DELETE an event.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION block_lottery_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'lottery_events is append-only: mutation of event id % is forbidden', COALESCE(NEW.id, OLD.id)
    USING ERRCODE = '42P10';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lottery_events_immutable ON lottery_events;
CREATE TRIGGER trg_lottery_events_immutable
  BEFORE UPDATE OR DELETE ON lottery_events
  FOR EACH ROW EXECUTE FUNCTION block_lottery_event_mutation();

-- Append-only audit trail for the new table as well.
DROP TRIGGER IF EXISTS trg_audit_lottery_events ON lottery_events;
CREATE TRIGGER trg_audit_lottery_events
  AFTER INSERT OR UPDATE OR DELETE ON lottery_events
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

COMMENT ON TABLE lottery_events IS
  'Immutable, append-only ledger of every lottery draw event. Writes are INSERT-only; UPDATE/DELETE raise an error.';
