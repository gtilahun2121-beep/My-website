-- =========================================================================
-- MIGRATION 016 — WEEKLY EQUB CYCLES
--
-- Extends the periodic-cycle engine (added in 015 for the Daily Equb model)
-- to support a Weekly Equb cadence on top of the same round-based engine.
--
-- A weekly equb (cycle_type = 'weekly') runs ONE draw every 7 days instead of
-- one draw per manual host trigger and instead of per-day. The working cycle
-- is the standard 2,000 ETB weekly tier:
--
--   * Days 1–6 : the weekly payment window (deposits accepted).
--   * Day 7    : reconciliation at the start of the day; the draw runs at the
--                configured payment_cutoff_time on the payment_cutoff_weekday.
--   * Late      : any approved member without a paid/auto-debited contribution
--                 for the week is charged a late penalty and locked out of
--                 that week's draw (they may resume next week).
--   * Rotation  : 1 winner per week until every member has received the pot
--                 once (current_round advances weekly).
--
-- Reuse: the daily_cycles / cycle_penalties tables from migration 015 are
-- cadence-agnostic and are shared — each weekly equb stores its weekly
-- cycle_date (the draw/cutoff date) there, and an equb is never both daily and
-- weekly, so rows cannot collide within UNIQUE(equb_id, cycle_date). The
-- existing DailyCycleModule keeps processing cycle_type='daily' rows untouched.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Extend the cycle_type enum with 'weekly'
-- -------------------------------------------------------------------------
ALTER TYPE equb_cycle_type ADD VALUE 'weekly';

-- -------------------------------------------------------------------------
-- 2. Weekly cutoff configuration on equb_groups
-- -------------------------------------------------------------------------
ALTER TABLE equb_groups
  ADD COLUMN IF NOT EXISTS payment_cutoff_weekday INT NOT NULL DEFAULT 6
    CHECK (payment_cutoff_weekday BETWEEN 0 AND 6);

COMMENT ON COLUMN equb_groups.payment_cutoff_weekday IS
  'Weekly equbs only. Day of the week (0=Sunday … 6=Saturday) on which the ' ||
  'payment window closes and the automatic weekly draw runs (Day 7). The ' ||
  'payment window itself spans the previous 6 days (Days 1-6). Defaults to 6 (Saturday).';
