-- =========================================================================
-- MIGRATION: Add FCFS Tier, Corporate/Private Toggle, and Preset Support
-- Date: 2026-08-29
-- =========================================================================

-- Add new columns to equb_groups table
ALTER TABLE equb_groups ADD COLUMN IF NOT EXISTS winner_selection_type VARCHAR(20) NOT NULL DEFAULT 'lottery' 
  CHECK (winner_selection_type IN ('lottery', 'fcfs', 'auction'));

ALTER TABLE equb_groups ADD COLUMN IF NOT EXISTS equb_type VARCHAR(20) NOT NULL DEFAULT 'public' 
  CHECK (equb_type IN ('public', 'private', 'corporate'));

ALTER TABLE equb_groups ADD COLUMN IF NOT EXISTS is_preset BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE equb_groups ADD COLUMN IF NOT EXISTS preset_template_id VARCHAR(50);

-- FCFS Payment Order Tracking
-- Tracks the order in which members paid for winner selection purposes
CREATE TABLE IF NOT EXISTS fcfs_payment_order (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equb_id         UUID NOT NULL REFERENCES equb_groups(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL CHECK (round_number > 0),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
  paid_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_order   INTEGER NOT NULL,
  UNIQUE (equb_id, round_number, user_id),
  UNIQUE (equb_id, round_number, payment_order)
);

CREATE INDEX IF NOT EXISTS idx_fcfs_payment_order_equb_round ON fcfs_payment_order(equb_id, round_number, payment_order);

-- Preset Equb Templates
CREATE TABLE IF NOT EXISTS equb_preset_templates (
  id                  VARCHAR(50) PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  description         TEXT,
  contribution_amount NUMERIC(15, 2) NOT NULL CHECK (contribution_amount > 0.00),
  total_rounds        INTEGER NOT NULL CHECK (total_rounds > 0),
  cycle_days          INTEGER NOT NULL CHECK (cycle_days >= 1),
  cycle_type          VARCHAR(20) NOT NULL DEFAULT 'round' CHECK (cycle_type IN ('round', 'daily', 'weekly')),
  winner_selection    VARCHAR(20) NOT NULL DEFAULT 'lottery' CHECK (winner_selection IN ('lottery', 'fcfs', 'auction')),
  equb_type           VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (equb_type IN ('public', 'private', 'corporate')),
  is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard presets
INSERT INTO equb_preset_templates (
  id, name, description, contribution_amount, total_rounds, cycle_days, cycle_type, winner_selection, equb_type, is_featured, display_order
) VALUES
  ('daily-300-103', 'Daily 300 ETB', 'Daily contribution for 103 days - perfect for daily savers', 300, 103, 1, 'daily', 'lottery', 'public', TRUE, 1),
  ('daily-1500-103', 'Daily 1,500 ETB', 'Daily contribution for 103 days - higher tier', 1500, 103, 1, 'daily', 'lottery', 'public', TRUE, 2),
  ('weekly-2000-12', 'Weekly 2,000 ETB', 'Weekly contribution for 12 weeks - standard weekly plan', 2000, 12, 7, 'weekly', 'lottery', 'public', TRUE, 3),
  ('monthly-10000-6', 'Monthly 10,000 ETB', 'Monthly contribution for 6 months - premium tier', 10000, 6, 30, 'round', 'lottery', 'public', TRUE, 4),
  ('fcfs-2000-12', 'FCFS Weekly 2,000 ETB', 'Weekly FCFS - winner by payment order, not lottery', 2000, 12, 7, 'weekly', 'fcfs', 'public', TRUE, 5),
  ('corporate-5000-10', 'Corporate Fund 5,000 ETB', 'Corporate equb for employee savings programs', 5000, 10, 30, 'round', 'lottery', 'corporate', FALSE, 6),
  ('private-3000-6', 'Private Circle 3,000 ETB', 'Private equb for trusted friends and family', 3000, 6, 30, 'round', 'lottery', 'private', FALSE, 7)
ON CONFLICT (id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE fcfs_payment_order IS 'Tracks payment arrival order for FCFS equbs - used to determine winner by who paid first';
COMMENT ON COLUMN equb_groups.winner_selection_type IS 'Type of winner selection: lottery (random), fcfs (first paid), or auction (bidding)';
COMMENT ON COLUMN equb_groups.equb_type IS 'Visibility/accessibility: public (anyone can join), private (invite-only), corporate (employee/organization)';
COMMENT ON COLUMN equb_groups.is_preset IS 'Whether this equb was created from a preset template';
COMMENT ON TABLE equb_preset_templates IS 'Standard equb templates for quick creation with common configurations';
