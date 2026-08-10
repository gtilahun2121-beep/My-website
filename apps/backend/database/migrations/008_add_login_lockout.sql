-- 008_add_login_lockout.sql
--
-- Escalating PIN lockout for failed login attempts.
--
--   failed_login_attempts  consecutive failed PIN attempts since the last
--                          successful login or lock expiry (resets to 0 on
--                          a successful login or when a lock is applied).
--
--   lockout_stage          0 = no lock ever / cleared
--                          1 = 6-hour lock  (after 3rd wrong PIN)
--                          2 = 1-day lock    (after 3 more wrong PINs)
--                          3 = 3-day lock    (after 3 more wrong PINs)
--                          4 = permanent     (blocked; admin must reset PIN)
--
--   locked_until           NULL when not locked, otherwise the timestamp the
--                          current lock expires. Stage 4 (permanent) uses a
--                          NULL locked_until combined with lockout_stage = 4.

ALTER TABLE users
    ADD COLUMN failed_login_attempts INTEGER    NOT NULL DEFAULT 0,
    ADD COLUMN lockout_stage         INTEGER    NOT NULL DEFAULT 0,
    ADD COLUMN locked_until          TIMESTAMPTZ;

CREATE INDEX idx_users_locked_until ON users (locked_until)
    WHERE locked_until IS NOT NULL;
