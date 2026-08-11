-- 009_add_pin_reset_codes.sql
--
-- PIN-reset OTP codes for the forgot-PIN / reset-PIN flow.
--
--   The plaintext OTP is NEVER stored. Only its SHA-256 hash is persisted,
--   so a database leak cannot be replayed as live codes.
--
--   Purpose 'pin_reset' — issued by POST /api/v1/auth/forgot-pin and
--   consumed by POST /api/v1/auth/verify-otp / reset-pin. A single
--   phone may have at most one active code; issuing a new one replaces
--   any outstanding code for that phone.

CREATE TABLE IF NOT EXISTS pin_reset_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(20) NOT NULL,
  purpose     VARCHAR(32) NOT NULL DEFAULT 'pin_reset',
  code_hash   VARCHAR(64) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER     NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fast lookup by phone for the active code; partial index ignores consumed rows.
CREATE INDEX idx_pin_reset_codes_phone_active
  ON pin_reset_codes (phone, created_at DESC)
  WHERE consumed_at IS NULL;

-- Deterministic SHA-256 of the plaintext Fayda ID. Used by verify-fayda to
-- detect duplicate registrations, because the fayda_id column itself is
-- stored encrypted (pgp_sym_encrypt) and cannot be compared directly.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS fayda_id_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_users_fayda_id_hash ON users (fayda_id_hash)
    WHERE fayda_id_hash IS NOT NULL;
