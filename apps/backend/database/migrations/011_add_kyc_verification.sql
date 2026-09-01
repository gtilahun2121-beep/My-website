-- =========================================================================
-- QALNET MIGRATION 011 - KYC / IDENTITY VERIFICATION
--
-- Wires the (already defined) verification_status enum onto the users
-- table and adds the audit timestamps + document reference an admin
-- console needs to run identity verification on members.
--
-- The verification_status enum was defined in the base schema but never
-- attached to a column. This migration attaches it with a safe default so
-- no existing rows break. Every statement is guarded and idempotent.
-- =========================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verification_status verification_status NOT NULL DEFAULT 'pending';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Admin console: list members by verification state
CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON users (verification_status);