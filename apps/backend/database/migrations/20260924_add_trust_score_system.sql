-- =========================================================================
-- QALNET MIGRATION 20260924 - TRUST SCORE SYSTEM
--
-- Implements reputation tracking, badge system, and historical scoring
-- A. trust_scores: Core reputation metrics per user
-- B. trust_badges: Achievement badges (verified, trusted, vip)
-- C. trust_history: Historical record of score changes
-- D. dispute_records: Track disputes for reputation impact
--
-- Every statement is guarded so the migration is idempotent.
-- =========================================================================

-- ── A. User Trust Scores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trust_scores (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Overall score (0-100)
  overall_score   NUMERIC(5, 2)  NOT NULL DEFAULT 50.00 CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Component scores (0-100 each, weighted average for overall)
  payment_punctuality_score   NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  completion_rate_score       NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  dispute_rate_score          NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  responsiveness_score        NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  
  -- Metrics
  total_payments              INTEGER NOT NULL DEFAULT 0,
  on_time_payments            INTEGER NOT NULL DEFAULT 0,
  late_payments               INTEGER NOT NULL DEFAULT 0,
  completed_cycles            INTEGER NOT NULL DEFAULT 0,
  total_cycles_participated   INTEGER NOT NULL DEFAULT 0,
  active_disputes             INTEGER NOT NULL DEFAULT 0,
  resolved_disputes           INTEGER NOT NULL DEFAULT 0,
  
  -- Time-based factors
  member_since                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Status
  status                      VARCHAR(20) NOT NULL DEFAULT 'active' 
                              CHECK (status IN ('active', 'suspended', 'banned')),
  suspension_reason           TEXT,
  created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_user_id ON trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_overall ON trust_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_trust_scores_status ON trust_scores(status);

-- ── B. Trust Badges ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trust_badges (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Badge type
  badge_type      VARCHAR(50)    NOT NULL CHECK (badge_type IN (
                    'verified_email', 'verified_phone', 'verified_kyc',
                    'trusted_member', 'vip_member',
                    'payment_streak_10', 'payment_streak_50', 'payment_streak_100',
                    'organizer', 'mentor', 'ambassador'
                  )),
  
  -- Badge metadata
  badge_name      VARCHAR(100)   NOT NULL,
  badge_description TEXT,
  badge_icon      VARCHAR(10),
  badge_color     VARCHAR(20),
  
  -- Achievement
  earned_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP WITH TIME ZONE,
  is_active       BOOLEAN DEFAULT TRUE,
  
  -- Criteria met
  criteria_met    JSONB,
  
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_badges_user_id ON trust_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_badges_type ON trust_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_trust_badges_active ON trust_badges(is_active) WHERE is_active = TRUE;

-- ── C. Trust Score History ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trust_score_history (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Score change
  previous_score  NUMERIC(5, 2)  NOT NULL,
  new_score       NUMERIC(5, 2)  NOT NULL,
  score_change    NUMERIC(5, 2)  NOT NULL,
  
  -- Event that triggered change
  event_type      VARCHAR(50)    NOT NULL CHECK (event_type IN (
                    'payment_on_time', 'payment_late', 'payment_failed',
                    'cycle_completed', 'cycle_failed', 'dispute_filed',
                    'dispute_resolved', 'dispute_won', 'dispute_lost',
                    'member_joined_equb', 'left_equb', 'kicked_from_equb',
                    'verified_email', 'verified_phone', 'verified_kyc',
                    'manual_adjustment', 'suspension', 'reactivation'
                  )),
  
  -- Metadata about the event
  event_metadata  JSONB,
  reason          TEXT,
  
  -- Who made the change
  changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_score_history_user_id ON trust_score_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_score_history_event ON trust_score_history(event_type);
CREATE INDEX IF NOT EXISTS idx_trust_score_history_date ON trust_score_history(created_at DESC);

-- ── D. Dispute Records ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_records (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dispute parties
  filed_by        UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  against_user    UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equb_id         UUID           REFERENCES equb_groups(id) ON DELETE SET NULL,
  payment_id      UUID           REFERENCES payments(id) ON DELETE SET NULL,
  
  -- Dispute details
  dispute_type    VARCHAR(50)    NOT NULL CHECK (dispute_type IN (
                    'payment_not_received', 'incorrect_amount', 'fraudulent_claim',
                    'non_compliance', 'harassment', 'other'
                  )),
  title           VARCHAR(255)   NOT NULL,
  description     TEXT           NOT NULL,
  
  -- Status
  status          VARCHAR(20)    NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  resolution      TEXT,
  
  -- Outcome
  outcome         VARCHAR(20)    CHECK (outcome IN ('filed_by_wins', 'against_user_wins', 'settled', 'withdrawn')),
  impact_on_filed_by NUMERIC(5, 2),    -- Score change for filer
  impact_on_against  NUMERIC(5, 2),    -- Score change for accused
  
  -- Timeline
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     TIMESTAMP WITH TIME ZONE,
  resolved_at     TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  evidence        JSONB,
  reviewer_notes  TEXT,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_disputes_filed_by ON dispute_records(filed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_against ON dispute_records(against_user);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON dispute_records(status);
CREATE INDEX IF NOT EXISTS idx_disputes_equb ON dispute_records(equb_id);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON dispute_records(created_at DESC);

-- ── RLS Policies ───────────────────────────────────────────────────────────

-- The policies below call auth.uid(), which Supabase provides but plain
-- PostgreSQL (e.g. this Neon project) does not. Create a minimal stand-in
-- that resolves the requesting user from the request.jwt.claim.sub GUC.
-- When unset it returns NULL — the API connects as the table owner, where
-- RLS is bypassed anyway — so these policies are inert but still valid SQL.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- CREATE POLICY has no IF NOT EXISTS pre-Postgres 18, so guard each policy
-- with a DO block to keep this migration idempotent and re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trust_scores' AND policyname='trust_scores_select') THEN
    CREATE POLICY trust_scores_select ON trust_scores
      FOR SELECT USING (TRUE);
  END IF;
END $$;

-- Users can only see their own detailed history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trust_score_history' AND policyname='trust_score_history_select') THEN
    CREATE POLICY trust_score_history_select ON trust_score_history
      FOR SELECT USING (
        user_id = auth.uid()
        OR changed_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
      );
  END IF;
END $$;

-- Users can view badges (public)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trust_badges' AND policyname='trust_badges_select') THEN
    CREATE POLICY trust_badges_select ON trust_badges
      FOR SELECT USING (TRUE);
  END IF;
END $$;

-- Users can view/file disputes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dispute_records' AND policyname='dispute_records_select') THEN
    CREATE POLICY dispute_records_select ON dispute_records
      FOR SELECT USING (
        filed_by = auth.uid()
        OR against_user = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
      );
  END IF;
END $$;

-- ── Triggers ───────────────────────────────────────────────────────────────

-- Auto-update trust_scores.updated_at
CREATE OR REPLACE FUNCTION update_trust_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trust_scores_update_timestamp ON trust_scores;
CREATE TRIGGER trust_scores_update_timestamp
  BEFORE UPDATE ON trust_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_scores_updated_at();

-- Create trust_score entry when user is created
CREATE OR REPLACE FUNCTION create_trust_score_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trust_scores (user_id, member_since)
  VALUES (NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_created_init_trust ON users;
CREATE TRIGGER user_created_init_trust
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_trust_score_for_user();
