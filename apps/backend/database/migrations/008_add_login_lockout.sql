-- 008_add_login_lockout.sql
--
-- Fixed PIN lockout for failed login attempts.
--
--   failed_login_attempts  consecutive failed PIN attempts since the last
--                          successful login or lock expiry (resets to 0 on
--                          a successful login, when a lock is applied, or
--                          when a lock expires).
--
--   lockout_stage          0 = no lock / cleared
--                          1 = 10-minute lock (after the 3rd consecutive
--                          wrong PIN). Always resets to 0 when the lock
--                          expires, so every lock is identical (10 minutes).
--
--   locked_until           NULL when not locked, otherwise the timestamp the
--                          current 10-minute lock expires. The account
--                          unlocks automatically once this time passes.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER    NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lockout_stage         INTEGER    NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users (locked_until)
    WHERE locked_until IS NOT NULL;
