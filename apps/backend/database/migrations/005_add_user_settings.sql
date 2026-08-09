-- =========================================================================
-- QALNET MIGRATION 005 — USER SETTINGS
-- Per-user security + appearance preferences:
--   * TOTP two-factor authentication (secret + enable flag + backup codes)
--   * Theme preference (light | dark | gold)
-- RLS policies mirror the users table so only the owner (or an admin) can
-- read/write their own settings row.
-- =========================================================================

-- RLS helper functions (idempotent — mirror schema.sql definitions so the
-- policies below work even if the base schema was applied partially).
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

CREATE TABLE IF NOT EXISTS user_settings (
  user_id            UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  two_factor_secret  TEXT,
  two_factor_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
  backup_codes       TEXT[]       NOT NULL DEFAULT '{}',
  theme              VARCHAR(10)  NOT NULL DEFAULT 'light'
                        CHECK (theme IN ('light', 'dark', 'gold')),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Backfill a settings row for every existing user so reads never 404.
INSERT INTO user_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_isolation_read ON user_settings;
CREATE POLICY user_settings_isolation_read ON user_settings
  FOR SELECT TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin');

DROP POLICY IF EXISTS user_settings_isolation_write ON user_settings;
CREATE POLICY user_settings_isolation_write ON user_settings
  FOR UPDATE TO public
  USING (user_id = current_user_id() OR current_user_role() = 'admin')
  WITH CHECK (user_id = current_user_id() OR current_user_role() = 'admin');
