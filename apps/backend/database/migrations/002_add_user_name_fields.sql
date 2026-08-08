-- =========================================================================
-- Migration 002: Add user name fields
-- Adds first_name and last_name to the users table.
-- =========================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT 'Unknown';

-- Remove the default after adding the column to enforce the NOT NULL constraint for future inserts
ALTER TABLE users ALTER COLUMN first_name DROP DEFAULT;
ALTER TABLE users ALTER COLUMN last_name DROP DEFAULT;
