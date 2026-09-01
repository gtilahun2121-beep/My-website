-- =========================================================================
-- MIGRATION 015 — DAILY EQUB CYCLES
--
-- Adds support for the Daily Equb model on top of the existing round-based
-- engine. A daily equb runs one draw PER DAY instead of one draw per manual
-- host trigger, with:
--
--   1. A daily payment window. Each day has an opening (00:00 local) and a
--      fixed cutoff time (equb_groups.payment_cutoff_time, default 17:00).
--      Contributions are only accepted while the window is open.
--   2. An automatic daily draw. At the cutoff the scheduled task closes the
--      window, applies late-payment penalties to anyone who did not pay, runs
--      the draw for the day's round, pays the winner, and opens the next day.
--   3. Late-payment penalties. Any approved member without a paid/auto-debited
--      contribution for the day's round is charged a penalty rate of the
--      contribution amount and locked out of that day's draw.
--
-- The existing round engine (equb_groups.current_round, lottery_draws,
-- payouts) is reused unchanged — each daily cycle maps 1:1 to a round.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. equb_groups: daily-mode configuration
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equb_cycle_type') THEN
    CREATE TYPE equb_cycle_type AS ENUM ('round', 'daily');
  END IF;
END
$$;

ALTER TABLE equb_groups
  ADD COLUMN IF NOT EXISTS cycle_type           equb_cycle_type NOT NULL DEFAULT 'round',
  ADD COLUMN IF NOT EXISTS payment_cutoff_time  TIME WITHOUT TIME ZONE NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS late_penalty_rate    NUMERIC(8, 6)    NOT NULL DEFAULT 0.02
                   CHECK (late_penalty_rate >= 0 AND late_penalty_rate <= 1),
  ADD COLUMN IF NOT EXISTS last_cycle_date      DATE;

COMMENT ON COLUMN equb_groups.cycle_type IS
  'round = classic manual-draw model; daily = one automated draw per day at payment_cutoff_time.';
COMMENT ON COLUMN equb_groups.payment_cutoff_time IS
  'Local time each day at which the payment window closes and the automatic daily draw runs (e.g. 17:00).';
COMMENT ON COLUMN equb_groups.late_penalty_rate IS
  'Fraction of the contribution amount charged to a member who misses the daily cutoff without paying.';
COMMENT ON COLUMN equb_groups.last_cycle_date IS
  'Date of the last completed daily cycle. Used to open the next cycle and to backfill missed days on restart.';

-- -------------------------------------------------------------------------
-- 2. daily_cycles — one row per operating day per daily equb
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_cycles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id     UUID        NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  cycle_date  DATE        NOT NULL,
  status      VARCHAR(16) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'drawn')),
  round_number INTEGER    NOT NULL DEFAULT 0 CHECK (round_number >= 0),
  opened_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at   TIMESTAMP WITH TIME ZONE,
  drawn_at    TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (equb_id, cycle_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_cycles_equb        ON daily_cycles (equb_id, cycle_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_cycles_equb_open   ON daily_cycles (equb_id, status) WHERE status = 'open';

COMMENT ON TABLE daily_cycles IS
  'Tracks the open/closed/drawn state of each daily operating day for daily-cycle equbs.';

-- -------------------------------------------------------------------------
-- 3. cycle_penalties — late-payment penalty ledger for daily cycles
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cycle_penalties (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id     UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  cycle_id    UUID           REFERENCES daily_cycles(id)       ON DELETE SET NULL,
  user_id     UUID           NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  cycle_date  DATE           NOT NULL,
  amount      NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  reason      VARCHAR(255)   NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (equb_id, user_id, cycle_date)
);

CREATE INDEX IF NOT EXISTS idx_cycle_penalties_equb_date ON cycle_penalties (equb_id, cycle_date);
CREATE INDEX IF NOT EXISTS idx_cycle_penalties_user      ON cycle_penalties (user_id);

COMMENT ON TABLE cycle_penalties IS
  'One row per member per missed daily cutoff. The penalty amount is debited from the member''s wallet.';
