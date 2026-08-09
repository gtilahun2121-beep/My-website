-- =========================================================================
-- QALNET MIGRATION 004 - USER PROFILE PHOTO
-- Adds a profile_photo column to the users table so a user's personal
-- photo persists in the database and is returned by GET /api/v1/users/me.
-- Stores the image as a data URL (base64), matching the JSON update flow.
-- =========================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo TEXT;
