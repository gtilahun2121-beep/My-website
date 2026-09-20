-- =========================================================================
-- QALNET ENTERPRISE DATABASE SCHEMA - RELATIONAL DDL
-- OPTIMIZED FOR NEON SERVERLESS POSTGRES (v18)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- CUSTOM TYPES AND ENUMS
-- =========================================================================
CREATE TYPE user_role AS ENUM ('participant', 'host', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE equb_status AS ENUM ('open', 'active', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'auto_debited', 'failed');
CREATE TYPE payout_status AS ENUM ('pending', 'approved', 'batched', 'completed', 'failed');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'rejected');
CREATE TYPE trust_tier AS ENUM ('standard', 'bronze', 'silver', 'gold', 'verified_trust');
CREATE TYPE alert_category AS ENUM ('operational', 'social_trust', 'system_policy');

-- =========================================================================
-- USERS TABLE (ENCRYPTED SECURE PROFILE LEDGER WITH FAYDA ID)
-- =========================================================================
CREATE TABLE users (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  phone             VARCHAR(20)  UNIQUE NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  telegram_handle   VARCHAR(100) UNIQUE,
  telegram_chat_id  BIGINT       UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  fayda_id          BYTEA,       -- Application-level encrypted Fayda ID (pgp_sym_encrypt)
  role              user_role    NOT NULL DEFAULT 'participant',
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  profile_photo     TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- SYSTEMIC CREDIT SCORE INDEX
-- =========================================================================
CREATE TABLE credit_scores (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID    UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trust_score               INTEGER NOT NULL DEFAULT 500 CHECK (trust_score BETWEEN 300 AND 850),
  tier                      trust_tier NOT NULL DEFAULT 'standard',
  successful_payments_count INTEGER NOT NULL DEFAULT 0,
  delayed_payments_count    INTEGER NOT NULL DEFAULT 0,
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- LOCAL DIGITAL WALLETS
-- =========================================================================
CREATE TABLE wallets (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID           UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance    NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
  currency   VARCHAR(10)    NOT NULL DEFAULT 'ETB',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ADMIN-MANAGED FEE CONFIGURATION
-- Fee split is controlled by Admin only. Some customers may disagree on
-- the split ratio, so it must never be hardcoded in application logic.
-- Constraint enforces: host_commission_rate + admin_fee_rate = total_fee_rate
-- =========================================================================
CREATE TABLE fee_config (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  total_fee_rate        NUMERIC(8, 6)  NOT NULL DEFAULT 0.001
                          CHECK (total_fee_rate > 0 AND total_fee_rate <= 0.05),
  host_commission_rate  NUMERIC(8, 6)  NOT NULL DEFAULT 0.0002
                          CHECK (host_commission_rate >= 0),
  admin_fee_rate        NUMERIC(8, 6)  NOT NULL DEFAULT 0.0008
                          CHECK (admin_fee_rate >= 0),
  effective_from        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  set_by_admin_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_fee_rates_sum
    CHECK (ABS((host_commission_rate + admin_fee_rate) - total_fee_rate) < 0.000001)
);

-- Seed default fee config: 0.1% total → 0.02% host + 0.08% admin
INSERT INTO fee_config (total_fee_rate, host_commission_rate, admin_fee_rate, is_active)
VALUES (0.001, 0.0002, 0.0008, TRUE);

-- =========================================================================
-- EQUB POOL GROUPS (WITH ACCUMULATING SOCIAL FUNDS)
-- =========================================================================
CREATE TABLE equb_groups (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                VARCHAR(100)   NOT NULL,
  description         TEXT,
  telegram_group_id   BIGINT         UNIQUE,
  total_amount        NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0.00),
  contribution_amount NUMERIC(15, 2) NOT NULL CHECK (contribution_amount > 0.00),
  cycle_days          INTEGER        NOT NULL CHECK (cycle_days >= 3),
  total_rounds        INTEGER        NOT NULL CHECK (total_rounds > 0),
  current_round       INTEGER        NOT NULL DEFAULT 0 CHECK (current_round <= total_rounds),
  status              equb_status    NOT NULL DEFAULT 'open',
  social_fund_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (social_fund_balance >= 0.00),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- MEMBERSHIPS TABLE (WITH AUTO-DEBIT CONSENT)
-- =========================================================================
CREATE TABLE memberships (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  equb_id            UUID NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  auto_debit_token   TEXT,
  consent_granted_at TIMESTAMP WITH TIME ZONE,
  joined_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, equb_id)
);

-- =========================================================================
-- PAYMENTS TABLE (WITH DOUBLE-PAYMENT VERIFICATION TRIGGERS)
-- fee_deducted      = platform's admin_fee_rate cut
-- host_commission_deducted = host's host_commission_rate cut
-- Both rates are resolved at runtime from the active fee_config row
-- =========================================================================
CREATE TABLE payments (
  id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  equb_id                     UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  round_number                INTEGER        NOT NULL CHECK (round_number > 0),
  amount                      NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  fee_deducted                NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (fee_deducted >= 0.00),
  host_commission_deducted    NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (host_commission_deducted >= 0.00),
  payment_status              payment_status NOT NULL DEFAULT 'pending',
  transaction_reference       VARCHAR(150)   UNIQUE,
  paid_at                     TIMESTAMP WITH TIME ZONE,
  created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_reference_on_success CHECK (
    (payment_status IN ('paid', 'auto_debited') AND transaction_reference IS NOT NULL AND paid_at IS NOT NULL)
    OR (payment_status IN ('pending', 'failed'))
  )
);

-- =========================================================================
-- ROTATION PAYOUT RECORDS
-- =========================================================================
CREATE TABLE payouts (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id          UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  round_number     INTEGER        NOT NULL CHECK (round_number > 0),
  winner_id        UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_pot_amount NUMERIC(15, 2) NOT NULL CHECK (total_pot_amount > 0.00),
  status           payout_status  NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (equb_id, round_number)
);

-- =========================================================================
-- MULTI-SIGNATURE APPROVAL TRACKER (FOR HIGH-CAPITAL POTS >= 1M ETB)
-- =========================================================================
CREATE TABLE multisig_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id    UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  approver_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (payout_id, approver_id)
);

-- =========================================================================
-- B2C BATCHED PAYOUT SCHEDULER
-- =========================================================================
CREATE TABLE payout_batches (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id             UUID           NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  amount                NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  scheduled_date        DATE           NOT NULL,
  processed_at          TIMESTAMP WITH TIME ZONE,
  transaction_reference VARCHAR(150)   UNIQUE,
  status                payment_status NOT NULL DEFAULT 'pending'
);

-- =========================================================================
-- SECONDARY MARKET LOTTERY SLOT TRADES ("WIN SELLING" LEDGER)
-- =========================================================================
CREATE TABLE payout_slot_trades (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id              UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE CASCADE,
  round_number         INTEGER        NOT NULL CHECK (round_number > 0),
  seller_user_id       UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_user_id        UUID           REFERENCES users(id) ON DELETE RESTRICT,
  premium_asking_price NUMERIC(15, 2) NOT NULL CHECK (premium_asking_price >= 0.00),
  trade_status         ticket_status  NOT NULL DEFAULT 'open',
  completed_at         TIMESTAMP WITH TIME ZONE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- COMMUNAL SOCIAL FUND PROPOSALS
-- =========================================================================
CREATE TABLE social_proposals (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id      UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE CASCADE,
  proposer_id  UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title        VARCHAR(150)   NOT NULL,
  description  TEXT           NOT NULL,
  budget       NUMERIC(15, 2) NOT NULL CHECK (budget > 0.00),
  status       ticket_status  NOT NULL DEFAULT 'open',
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- SOCIAL FUND DEMOCRATIC VOTES
-- =========================================================================
CREATE TABLE social_votes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID    NOT NULL REFERENCES social_proposals(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vote_value  BOOLEAN NOT NULL, -- TRUE = Approve, FALSE = Reject
  voted_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (proposal_id, user_id)
);

-- =========================================================================
-- NOTIFICATION ENGINE DISPATCH LOGS
-- =========================================================================
CREATE TABLE notifications (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category           alert_category NOT NULL,
  title              VARCHAR(150)   NOT NULL,
  body               TEXT           NOT NULL,
  is_read            BOOLEAN        NOT NULL DEFAULT FALSE,
  delivered_channels VARCHAR(50)    NOT NULL, -- e.g. 'telegram,sms,push'
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- RECONCILIATION AND DISPUTE TICKET SYSTEM
-- =========================================================================
CREATE TABLE reconciliation_tickets (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payment_id            UUID           REFERENCES payments(id) ON DELETE SET NULL,
  transaction_reference VARCHAR(150)   NOT NULL,
  reported_amount       NUMERIC(15, 2) NOT NULL CHECK (reported_amount > 0.00),
  status                ticket_status  NOT NULL DEFAULT 'open',
  assigned_admin_id     UUID           REFERENCES users(id) ON DELETE SET NULL,
  notes                 TEXT,
  resolved_at           TIMESTAMP WITH TIME ZONE,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- CRB DEFAULTER BLACKLIST RECORD
-- =========================================================================
CREATE TABLE crb_blacklists (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason      TEXT    NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_released BOOLEAN NOT NULL DEFAULT FALSE,
  released_at TIMESTAMP WITH TIME ZONE
);

-- =========================================================================
-- USSD ACTIVE SESSIONS
-- =========================================================================
CREATE TABLE ussd_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number     VARCHAR(20) NOT NULL,
  session_id       VARCHAR(150) UNIQUE NOT NULL,
  last_menu_state  VARCHAR(50) NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- LOTTERY DRAWS RECORD (WITH SVG CANVAS DATA)
-- Winner selected via OS-level CSPRNG (Python secrets module)
-- =========================================================================
CREATE TABLE lottery_draws (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id         UUID    NOT NULL REFERENCES equb_groups(id) ON DELETE RESTRICT,
  round_number    INTEGER NOT NULL CHECK (round_number > 0),
  winner_id       UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  draw_timestamp  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  video_url       TEXT,
  svg_canvas_data TEXT,
  is_purged       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (equb_id, round_number)
);

-- =========================================================================
-- SECURITY AUDIT TRAIL LOGS
-- =========================================================================
CREATE TABLE audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   VARCHAR(100) NOT NULL,
  action       VARCHAR(20)  NOT NULL,
  row_id       UUID         NOT NULL,
  old_values   JSONB,
  new_values   JSONB,
  performed_by UUID,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- INDEX OPTIMIZATIONS
-- =========================================================================
CREATE INDEX idx_users_phone         ON users(phone);
CREATE INDEX idx_credit_scores_user  ON credit_scores(user_id);
CREATE INDEX idx_wallets_user        ON wallets(user_id);
CREATE INDEX idx_memberships_equb    ON memberships(equb_id);
CREATE INDEX idx_payments_lookup     ON payments(user_id, equb_id, round_number);
CREATE INDEX idx_payments_unpaid     ON payments(payment_status) WHERE payment_status = 'pending';
CREATE INDEX idx_payout_batches_date ON payout_batches(scheduled_date) WHERE status = 'pending';
CREATE INDEX idx_reconciliation_ref  ON reconciliation_tickets(transaction_reference);
CREATE INDEX idx_fee_config_active   ON fee_config(is_active, effective_from);

-- =========================================================================
-- DATABASE AUDIT ENGINE TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
BEGIN
  BEGIN
    actor_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    actor_id := NULL;
  END;
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (table_name, action, row_id, old_values, new_values, performed_by)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD), NULL, actor_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (table_name, action, row_id, old_values, new_values, performed_by)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW), actor_id);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (table_name, action, row_id, old_values, new_values, performed_by)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, NULL, to_jsonb(NEW), actor_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER trg_audit_wallets
  AFTER INSERT OR UPDATE OR DELETE ON wallets
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER trg_audit_fee_config
  AFTER INSERT OR UPDATE OR DELETE ON fee_config
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- =========================================================================
-- ROW-LEVEL SECURITY ENFORCEMENT POLICIES (RLS)
-- =========================================================================
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users    FORCE  ROW LEVEL SECURITY;
ALTER TABLE wallets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets  FORCE  ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE  ROW LEVEL SECURITY;

-- Dynamic Context Resolution STABLE Functions
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS VARCHAR AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_role', true), '')::VARCHAR;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS Isolation Policies (defense-in-depth even if application tier logic fails)
CREATE POLICY user_isolation_read ON users
  FOR SELECT TO public
  USING (id = current_user_id() OR current_user_role() = 'admin');

CREATE POLICY user_isolation_write ON users
  FOR UPDATE TO public
  USING (id = current_user_id() OR current_user_role() = 'admin')
  WITH CHECK (id = current_user_id() OR current_user_role() = 'admin');

CREATE POLICY wallet_isolation_read ON wallets
  FOR SELECT TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin');

CREATE POLICY payment_isolation_read ON payments
  FOR SELECT TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin');

CREATE POLICY payment_isolation_write ON payments
  FOR ALL TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin')
  WITH CHECK (user_id = current_user_id() OR current_user_role() = 'admin');

-- Restrict dynamic session parameter modifications to trusted server-side queries only
REVOKE ALL ON SCHEMA pg_catalog FROM public;

-- =========================================================================
-- REFRESH TOKENS (SESSION ROTATION)
-- =========================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- =========================================================================
-- ADDITIVE CLEAN-UP (runs LAST — these statements reference tables and
-- helper functions created above, so they must execute after them. Kept as
-- one top-to-bottom runnable file so a fresh `docker compose up` can apply
-- the whole schema through PostgreSQL's /docker-entrypoint-initdb.d hook.)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- =========================================================================
-- USER SETTINGS (TOTP 2FA + APPEARANCE PREFERENCE)
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id            UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  two_factor_secret  TEXT,
  two_factor_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
  backup_codes       TEXT[]       NOT NULL DEFAULT '{}',
  theme              VARCHAR(10)  NOT NULL DEFAULT 'light'
                        CHECK (theme IN ('light', 'dark', 'gold')),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_isolation_read ON user_settings;
CREATE POLICY user_settings_isolation_read ON user_settings
  FOR SELECT TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin');

DROP POLICY IF EXISTS user_settings_isolation_write ON user_settings;
CREATE POLICY user_settings_isolation_write ON user_settings
  FOR UPDATE TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin')
  WITH CHECK (user_id = current_user_id() OR current_user_role() = 'admin');

-- =========================================================================
-- QUERY EFFICIENCY INDEXES (migration 006)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memberships_user          ON memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_equb_groups_host_status   ON equb_groups (host_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_equb_status       ON payouts (equb_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_equb_status      ON payments (equb_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_lottery_draws_equb        ON lottery_draws (equb_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_row            ON audit_logs (row_id, performed_at DESC);
