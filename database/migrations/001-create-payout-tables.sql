-- QalNet Winner Selection & Payout System Schema
-- PostgreSQL Migrations
-- Created: August 29, 2026

-- ============================================================================
-- Table 1: Payout Cycles
-- Tracks each round of payout for each equb
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_cycles (
  id SERIAL PRIMARY KEY,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  cycle_number INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'selection_in_progress', 'winner_selected', 'payout_in_progress', 'completed', 'cancelled')),
  selection_model VARCHAR(20) NOT NULL CHECK (selection_model IN ('lottery', 'prime_option', 'fcfs')),
  
  -- Timing
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  selection_date TIMESTAMP,
  payout_start_date TIMESTAMP,
  payout_due_date TIMESTAMP,
  
  -- Financial
  total_pooled_amount DECIMAL(15, 2) DEFAULT 0,
  total_contributions_received DECIMAL(15, 2) DEFAULT 0,
  number_of_members INT DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(equb_id, cycle_number)
);

CREATE INDEX idx_payout_cycles_equb ON payout_cycles(equb_id);
CREATE INDEX idx_payout_cycles_status ON payout_cycles(status);
CREATE INDEX idx_payout_cycles_equb_cycle ON payout_cycles(equb_id, cycle_number);
CREATE INDEX idx_payout_cycles_selection_date ON payout_cycles(selection_date DESC);

-- ============================================================================
-- Table 2: Member Eligibility Status
-- Tracks eligibility of each member for each cycle
-- ============================================================================
CREATE TABLE IF NOT EXISTS member_eligibility_status (
  id SERIAL PRIMARY KEY,
  payout_cycle_id INT NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Contribution tracking
  contribution_status VARCHAR(20) DEFAULT 'unpaid' CHECK (contribution_status IN ('paid', 'partial', 'unpaid')),
  contribution_amount DECIMAL(12, 2) DEFAULT 0,
  required_amount DECIMAL(12, 2) NOT NULL,
  payment_date TIMESTAMP,
  
  -- Eligibility flags
  is_eligible BOOLEAN DEFAULT FALSE,
  is_past_winner BOOLEAN DEFAULT FALSE,
  is_excluded BOOLEAN DEFAULT FALSE,
  exclusion_reason VARCHAR(255),
  
  -- Verification
  verified_at TIMESTAMP,
  verified_by INT REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(payout_cycle_id, member_id)
);

CREATE INDEX idx_member_eligibility_cycle ON member_eligibility_status(payout_cycle_id);
CREATE INDEX idx_member_eligibility_member ON member_eligibility_status(member_id);
CREATE INDEX idx_member_eligibility_status ON member_eligibility_status(is_eligible);
CREATE INDEX idx_member_eligibility_equb_member ON member_eligibility_status(equb_id, member_id);

-- ============================================================================
-- Table 3: Winner Selections
-- Stores the result of each winner selection
-- ============================================================================
CREATE TABLE IF NOT EXISTS winner_selections (
  id SERIAL PRIMARY KEY,
  payout_cycle_id INT NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  winner_member_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Selection details
  selection_model VARCHAR(20) NOT NULL CHECK (selection_model IN ('lottery', 'prime_option', 'fcfs')),
  selection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- For Lottery model
  seed VARCHAR(255),  -- For reproducibility
  weight DECIMAL(10, 6),  -- Calculated weight for winner
  
  -- For Prime Option model
  bid_amount DECIMAL(12, 2),
  
  -- For FCFS model
  request_sequence INT,
  
  -- Verification
  proof_data JSONB,  -- Audit data (algorithm params, etc)
  verification_hash VARCHAR(255),  -- Hash for tampering detection
  verified_at TIMESTAMP,
  verified_by INT REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(payout_cycle_id)
);

CREATE INDEX idx_winner_selections_cycle ON winner_selections(payout_cycle_id);
CREATE INDEX idx_winner_selections_winner ON winner_selections(winner_member_id);
CREATE INDEX idx_winner_selections_equb ON winner_selections(equb_id);
CREATE INDEX idx_winner_selections_timestamp ON winner_selections(selection_timestamp DESC);

-- ============================================================================
-- Table 4: Prime Option Requests (Bidding)
-- Tracks bids for prime option selection model
-- ============================================================================
CREATE TABLE IF NOT EXISTS prime_option_requests (
  id SERIAL PRIMARY KEY,
  payout_cycle_id INT NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Bid details
  bid_amount DECIMAL(12, 2) NOT NULL,
  bid_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bid_round INT DEFAULT 1,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'replaced')),
  resolution_timestamp TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(payout_cycle_id, member_id)
);

CREATE INDEX idx_prime_option_cycle ON prime_option_requests(payout_cycle_id);
CREATE INDEX idx_prime_option_member ON prime_option_requests(member_id);
CREATE INDEX idx_prime_option_status ON prime_option_requests(status);
CREATE INDEX idx_prime_option_bid_amount ON prime_option_requests(payout_cycle_id, bid_amount DESC);

-- ============================================================================
-- Table 5: Payout History
-- Records actual payouts made to winners
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_history (
  id SERIAL PRIMARY KEY,
  payout_cycle_id INT NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
  winner_member_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  
  -- Amount details
  gross_amount DECIMAL(15, 2) NOT NULL,
  fees_amount DECIMAL(15, 2) DEFAULT 0,
  net_amount DECIMAL(15, 2) NOT NULL,
  
  -- Payment details
  payment_provider VARCHAR(50) NOT NULL,  -- telebirr, cbe, abyssinia, dashen, awash, nib
  provider_transaction_id VARCHAR(100),
  recipient_account VARCHAR(100),  -- Phone, account number, etc
  
  -- Status tracking
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'reversal', 'disputed')),
  attempt_count INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payout_history_cycle ON payout_history(payout_cycle_id);
CREATE INDEX idx_payout_history_winner ON payout_history(winner_member_id);
CREATE INDEX idx_payout_history_status ON payout_history(payment_status);
CREATE INDEX idx_payout_history_equb ON payout_history(equb_id);
CREATE INDEX idx_payout_history_provider ON payout_history(payment_provider);

-- ============================================================================
-- Table 6: Payout Verification
-- Stores verification details for early winner protection
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_verification (
  id SERIAL PRIMARY KEY,
  payout_history_id INT NOT NULL REFERENCES payout_history(id) ON DELETE CASCADE,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  
  -- Verification type and status
  verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('self_declaration', 'collateral', 'guarantor', 'community_validation')),
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'expired')),
  
  -- For collateral verification
  collateral_amount DECIMAL(15, 2),
  collateral_type VARCHAR(50),  -- cash, property, etc
  collateral_description TEXT,
  
  -- For guarantor verification
  guarantor_name VARCHAR(100),
  guarantor_phone VARCHAR(20),
  guarantor_id_type VARCHAR(20),
  guarantor_id_number VARCHAR(50),
  
  -- Verification workflow
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  verified_by INT REFERENCES users(id) ON DELETE SET NULL,
  verification_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payout_verification_payout ON payout_verification(payout_history_id);
CREATE INDEX idx_payout_verification_status ON payout_verification(verification_status);
CREATE INDEX idx_payout_verification_type ON payout_verification(verification_type);

-- ============================================================================
-- Table 7: Payment Reminders
-- Tracks payment reminders sent to members for contributions
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_reminders (
  id SERIAL PRIMARY KEY,
  payout_cycle_id INT NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  
  -- Reminder tracking
  reminder_number INT DEFAULT 1,
  reminder_type VARCHAR(20) DEFAULT 'contribution' CHECK (reminder_type IN ('contribution', 'winner_payment', 'dispute_action')),
  
  -- Escalation
  escalation_level INT DEFAULT 1 CHECK (escalation_level IN (1, 2, 3)),
  -- Level 1: In-app notification
  -- Level 2: SMS + In-app
  -- Level 3: Phone call + Admin involvement
  
  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  
  -- Content
  message_template VARCHAR(255),
  custom_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_reminders_cycle ON payment_reminders(payout_cycle_id);
CREATE INDEX idx_payment_reminders_member ON payment_reminders(member_id);
CREATE INDEX idx_payment_reminders_scheduled ON payment_reminders(scheduled_at);
CREATE INDEX idx_payment_reminders_status ON payment_reminders(delivery_status);

-- ============================================================================
-- Table 8: Dispute Resolution
-- Tracks disputes related to payout and winner selection
-- ============================================================================
CREATE TABLE IF NOT EXISTS dispute_resolution (
  id SERIAL PRIMARY KEY,
  payout_cycle_id INT REFERENCES payout_cycles(id) ON DELETE SET NULL,
  payout_history_id INT REFERENCES payout_history(id) ON DELETE SET NULL,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  
  -- Parties involved
  reported_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reported_against INT REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Dispute details
  dispute_type VARCHAR(50) NOT NULL CHECK (dispute_type IN ('double_payout', 'late_payout', 'wrong_amount', 'payment_failed', 'winner_selection_unfair', 'member_excluded_unfairly', 'other')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Evidence
  attached_documents JSONB,  -- URLs to uploaded proof
  evidence_count INT DEFAULT 0,
  
  -- Status and resolution
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed', 'appealed')),
  investigation_notes TEXT,
  resolution TEXT,
  resolution_type VARCHAR(20) CHECK (resolution_type IN ('refund', 'retry_payout', 'compensation', 'rejected', 'partial_refund')),
  
  -- Timeline
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  investigated_by INT REFERENCES users(id) ON DELETE SET NULL,
  investigated_at TIMESTAMP,
  resolved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dispute_resolution_cycle ON dispute_resolution(payout_cycle_id);
CREATE INDEX idx_dispute_resolution_payout ON dispute_resolution(payout_history_id);
CREATE INDEX idx_dispute_resolution_equb ON dispute_resolution(equb_id);
CREATE INDEX idx_dispute_resolution_status ON dispute_resolution(status);
CREATE INDEX idx_dispute_resolution_reporter ON dispute_resolution(reported_by);
CREATE INDEX idx_dispute_resolution_type ON dispute_resolution(dispute_type);

-- ============================================================================
-- Audit Triggers
-- Track all changes to payout tables for compliance
-- ============================================================================

-- Create audit table for payouts
CREATE TABLE IF NOT EXISTS payout_audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50),
  record_id INT,
  operation VARCHAR(10) CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by INT REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payout_audit_table ON payout_audit_log(table_name);
CREATE INDEX idx_payout_audit_record ON payout_audit_log(table_name, record_id);
CREATE INDEX idx_payout_audit_timestamp ON payout_audit_log(changed_at DESC);

-- ============================================================================
-- Constraints & Checks
-- ============================================================================

-- Ensure payout cycle dates are logical
ALTER TABLE payout_cycles ADD CONSTRAINT check_cycle_dates 
CHECK (start_date < end_date);

-- Ensure amounts are positive
ALTER TABLE payout_history ADD CONSTRAINT check_positive_amounts 
CHECK (gross_amount > 0 AND net_amount > 0 AND fees_amount >= 0);

ALTER TABLE prime_option_requests ADD CONSTRAINT check_positive_bid 
CHECK (bid_amount > 0);

-- ============================================================================
-- Grants (adjust to your user/role setup)
-- ============================================================================

-- Ensure all tables are readable by app user
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT INSERT, UPDATE, DELETE ON payout_cycles, winner_selections, payout_history, dispute_resolution TO app_user;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- This migration creates the foundation for the Winner Selection & Payout System.
-- Next: Run migrations/002-create-indices.sql for performance optimization
-- Then: Run migrations/003-create-views.sql for reporting views
