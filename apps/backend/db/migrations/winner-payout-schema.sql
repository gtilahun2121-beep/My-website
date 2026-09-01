-- ============================================================================
-- MY EQUB: Winner Selection & Payout System Database Schema
-- ============================================================================
-- This schema supports three winner selection models:
-- 1. LOTTERY - Random selection with eligibility tracking
-- 2. PRIME - Bidding/premium payout option
-- 3. FCFS - First-come, first-served selection
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: payout_cycles
-- Description: Tracks each payout cycle/round in an equb
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equb_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    payout_model VARCHAR(20) NOT NULL CHECK (payout_model IN ('LOTTERY', 'PRIME', 'FCFS')),
    cycle_start TIMESTAMP NOT NULL,
    cycle_end TIMESTAMP NOT NULL,
    pool_amount DECIMAL(15, 2) NOT NULL CHECK (pool_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' 
        CHECK (status IN ('OPEN', 'DRAWING', 'DISBURSED', 'CANCELLED')),
    selected_winner_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_cycle_dates CHECK (cycle_end > cycle_start),
    CONSTRAINT uq_equb_round UNIQUE (equb_id, round_number)
);

-- Index for faster queries
CREATE INDEX idx_payout_cycles_equb_id ON payout_cycles(equb_id);
CREATE INDEX idx_payout_cycles_status ON payout_cycles(status);
CREATE INDEX idx_payout_cycles_winner_id ON payout_cycles(selected_winner_id);
CREATE INDEX idx_payout_cycles_created_at ON payout_cycles(created_at);

-- ============================================================================
-- TABLE: member_eligibility_status
-- Description: Tracks participation and eligibility per payout cycle
-- ============================================================================
CREATE TABLE IF NOT EXISTS member_eligibility_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL,
    has_paid_contribution BOOLEAN NOT NULL DEFAULT FALSE,
    is_past_winner BOOLEAN NOT NULL DEFAULT FALSE,
    has_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
    last_payment_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT uq_member_cycle_eligibility UNIQUE (payout_cycle_id, member_id),
    CONSTRAINT chk_last_payment_valid CHECK (
        last_payment_date IS NULL OR last_payment_date <= CURRENT_TIMESTAMP
    )
);

-- Indices for eligibility queries
CREATE INDEX idx_member_eligibility_cycle_id ON member_eligibility_status(payout_cycle_id);
CREATE INDEX idx_member_eligibility_member_id ON member_eligibility_status(member_id);
CREATE INDEX idx_member_eligibility_has_paid ON member_eligibility_status(has_paid_contribution);
CREATE INDEX idx_member_eligibility_past_winner ON member_eligibility_status(is_past_winner);
CREATE INDEX idx_member_eligibility_opted_out ON member_eligibility_status(has_opted_out);

-- ============================================================================
-- TABLE: winner_selections
-- Description: Audit trail of every winner draw/selection
-- ============================================================================
CREATE TABLE IF NOT EXISTS winner_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
    winner_id UUID NOT NULL,
    selection_method VARCHAR(50) NOT NULL,
    selected_at TIMESTAMP NOT NULL,
    selection_timestamp BIGINT,
    prng_seed VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_selection_method CHECK (
        selection_method IN ('LOTTERY', 'PRIME_BID', 'FCFS', 'MANUAL', 'SYSTEM')
    ),
    CONSTRAINT uq_one_winner_per_cycle UNIQUE (payout_cycle_id)
);

-- Indices for winner selection audit
CREATE INDEX idx_winner_selections_cycle_id ON winner_selections(payout_cycle_id);
CREATE INDEX idx_winner_selections_winner_id ON winner_selections(winner_id);
CREATE INDEX idx_winner_selections_method ON winner_selections(selection_method);
CREATE INDEX idx_winner_selections_is_verified ON winner_selections(is_verified);
CREATE INDEX idx_winner_selections_created_at ON winner_selections(created_at);

-- ============================================================================
-- TABLE: prime_option_requests
-- Description: Tracks bidding and premium payout model requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS prime_option_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL,
    bid_amount DECIMAL(15, 2) NOT NULL CHECK (bid_amount > 0),
    fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    priority_rank INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'APPROVED', 'USED', 'REJECTED')),
    rejection_reason TEXT,
    requested_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_bid_requested_at CHECK (requested_at <= CURRENT_TIMESTAMP),
    CONSTRAINT uq_member_cycle_prime UNIQUE (payout_cycle_id, member_id)
);

-- Indices for prime option queries
CREATE INDEX idx_prime_requests_cycle_id ON prime_option_requests(payout_cycle_id);
CREATE INDEX idx_prime_requests_member_id ON prime_option_requests(member_id);
CREATE INDEX idx_prime_requests_status ON prime_option_requests(status);
CREATE INDEX idx_prime_requests_priority_rank ON prime_option_requests(priority_rank);
CREATE INDEX idx_prime_requests_bid_amount ON prime_option_requests(bid_amount DESC);

-- ============================================================================
-- TABLE: payout_history
-- Description: Complete transaction log for all payouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(id) ON DELETE RESTRICT,
    winner_id UUID NOT NULL,
    pot_amount DECIMAL(15, 2) NOT NULL CHECK (pot_amount >= 0),
    net_amount DECIMAL(15, 2) NOT NULL CHECK (net_amount >= 0),
    fee_charged DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (fee_charged >= 0),
    payment_gateway VARCHAR(100),
    payment_reference VARCHAR(255) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DISPUTED')),
    disbursed_to_account_encrypted TEXT,
    disbursed_to_account_iv TEXT,
    account_holder_name_encrypted TEXT,
    account_holder_name_iv TEXT,
    disbursed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_net_not_greater_than_pot CHECK (net_amount <= pot_amount),
    CONSTRAINT chk_fee_calculation CHECK (
        net_amount + fee_charged = pot_amount OR 
        status IN ('FAILED', 'DISPUTED')
    ),
    CONSTRAINT chk_disbursed_at_valid CHECK (
        (status = 'COMPLETED' AND disbursed_at IS NOT NULL) OR
        (status != 'COMPLETED')
    ),
    CONSTRAINT uq_payout_cycle_winner UNIQUE (payout_cycle_id, winner_id)
);

-- Indices for payout history queries
CREATE INDEX idx_payout_history_cycle_id ON payout_history(payout_cycle_id);
CREATE INDEX idx_payout_history_winner_id ON payout_history(winner_id);
CREATE INDEX idx_payout_history_status ON payout_history(status);
CREATE INDEX idx_payout_history_payment_reference ON payout_history(payment_reference);
CREATE INDEX idx_payout_history_disbursed_at ON payout_history(disbursed_at);
CREATE INDEX idx_payout_history_created_at ON payout_history(created_at);

-- ============================================================================
-- TABLE: payout_verification
-- Description: Risk management and collateral tracking for payouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_verification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_history_id UUID NOT NULL REFERENCES payout_history(id) ON DELETE CASCADE,
    winner_id UUID NOT NULL,
    verification_type VARCHAR(50) NOT NULL 
        CHECK (verification_type IN ('ID', 'GUARANTOR', 'COLLATERAL', 'BANK_ACCOUNT', 'MOBILE_MONEY')),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
    verified_by UUID,
    verification_document_url TEXT,
    document_iv TEXT,
    notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for verification queries
CREATE INDEX idx_verification_payout_history_id ON payout_verification(payout_history_id);
CREATE INDEX idx_verification_winner_id ON payout_verification(winner_id);
CREATE INDEX idx_verification_type ON payout_verification(verification_type);
CREATE INDEX idx_verification_status ON payout_verification(verification_status);

-- ============================================================================
-- TABLE: payment_reminders
-- Description: Automated reminder system for contributions and payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equb_id UUID NOT NULL,
    member_id UUID NOT NULL,
    payout_cycle_id UUID REFERENCES payout_cycles(id) ON DELETE SET NULL,
    reminder_type VARCHAR(50) NOT NULL
        CHECK (reminder_type IN ('CONTRIBUTION', 'UPCOMING_DRAW', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'PAYOUT_READY')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED')),
    sent_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP,
    channel VARCHAR(50) CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_sent_acknowledged CHECK (
        (status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL) OR
        (status != 'ACKNOWLEDGED')
    )
);

-- Indices for reminder queries
CREATE INDEX idx_reminders_equb_id ON payment_reminders(equb_id);
CREATE INDEX idx_reminders_member_id ON payment_reminders(member_id);
CREATE INDEX idx_reminders_cycle_id ON payment_reminders(payout_cycle_id);
CREATE INDEX idx_reminders_status ON payment_reminders(status);
CREATE INDEX idx_reminders_type ON payment_reminders(reminder_type);
CREATE INDEX idx_reminders_sent_at ON payment_reminders(sent_at);

-- ============================================================================
-- TABLE: dispute_resolution
-- Description: Payment dispute tracking and resolution workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS dispute_resolution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_history_id UUID NOT NULL REFERENCES payout_history(id) ON DELETE CASCADE,
    dispute_reason VARCHAR(500) NOT NULL,
    raised_by_member_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'APPEALED')),
    resolution_notes TEXT,
    resolution_type VARCHAR(50) CHECK (resolution_type IN ('APPROVED', 'REJECTED', 'PARTIAL', 'REFUNDED')),
    resolved_by UUID,
    resolved_at TIMESTAMP,
    amount_disputed DECIMAL(15, 2),
    amount_refunded DECIMAL(15, 2) CHECK (amount_refunded >= 0),
    refund_reference VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_resolved_details CHECK (
        (status IN ('RESOLVED', 'CLOSED') AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL) OR
        (status NOT IN ('RESOLVED', 'CLOSED'))
    )
);

-- Indices for dispute queries
CREATE INDEX idx_disputes_payout_history_id ON dispute_resolution(payout_history_id);
CREATE INDEX idx_disputes_raised_by ON dispute_resolution(raised_by_member_id);
CREATE INDEX idx_disputes_status ON dispute_resolution(status);
CREATE INDEX idx_disputes_resolved_at ON dispute_resolution(resolved_at);
CREATE INDEX idx_disputes_created_at ON dispute_resolution(created_at);

-- ============================================================================
-- VIEWS FOR COMMON OPERATIONS
-- ============================================================================

-- View: Active Payout Cycles
CREATE OR REPLACE VIEW v_active_payout_cycles AS
SELECT 
    pc.id,
    pc.equb_id,
    pc.round_number,
    pc.payout_model,
    pc.cycle_start,
    pc.cycle_end,
    pc.pool_amount,
    pc.status,
    COUNT(DISTINCT mes.member_id) as total_members,
    COUNT(DISTINCT CASE WHEN mes.has_paid_contribution THEN mes.member_id END) as paid_members,
    COUNT(DISTINCT CASE WHEN mes.is_past_winner THEN mes.member_id END) as past_winners,
    COUNT(DISTINCT CASE WHEN mes.has_opted_out THEN mes.member_id END) as opted_out_members
FROM payout_cycles pc
LEFT JOIN member_eligibility_status mes ON pc.id = mes.payout_cycle_id
WHERE pc.status IN ('OPEN', 'DRAWING')
GROUP BY pc.id, pc.equb_id, pc.round_number, pc.payout_model, 
         pc.cycle_start, pc.cycle_end, pc.pool_amount, pc.status;

-- View: Eligible Members for Drawing
CREATE OR REPLACE VIEW v_eligible_members_for_draw AS
SELECT 
    mes.payout_cycle_id,
    mes.member_id,
    pc.payout_model,
    pc.pool_amount,
    mes.has_paid_contribution,
    mes.is_past_winner,
    mes.has_opted_out
FROM member_eligibility_status mes
JOIN payout_cycles pc ON mes.payout_cycle_id = pc.id
WHERE 
    mes.has_paid_contribution = TRUE
    AND mes.is_past_winner = FALSE
    AND mes.has_opted_out = FALSE
    AND pc.status IN ('OPEN', 'DRAWING');

-- View: Top Prime Bidders
CREATE OR REPLACE VIEW v_top_prime_bidders AS
SELECT 
    por.payout_cycle_id,
    por.member_id,
    por.bid_amount,
    por.fee_percentage,
    (por.bid_amount * (1 - por.fee_percentage / 100)) as net_bid_amount,
    por.priority_rank,
    por.status,
    pc.pool_amount
FROM prime_option_requests por
JOIN payout_cycles pc ON por.payout_cycle_id = pc.id
WHERE por.status IN ('PENDING', 'APPROVED')
ORDER BY por.priority_rank ASC, por.bid_amount DESC;

-- View: Member Payout History Summary
CREATE OR REPLACE VIEW v_member_payout_history_summary AS
SELECT 
    ph.winner_id,
    pc.equb_id,
    COUNT(*) as total_payouts,
    SUM(ph.pot_amount) as total_pot_received,
    SUM(ph.net_amount) as total_net_received,
    SUM(ph.fee_charged) as total_fees_paid,
    COUNT(DISTINCT CASE WHEN ph.status = 'COMPLETED' THEN ph.id END) as completed_payouts,
    COUNT(DISTINCT CASE WHEN ph.status = 'FAILED' THEN ph.id END) as failed_payouts,
    COUNT(DISTINCT CASE WHEN ph.status = 'DISPUTED' THEN ph.id END) as disputed_payouts,
    MAX(ph.disbursed_at) as last_payout_date
FROM payout_history ph
JOIN payout_cycles pc ON ph.payout_cycle_id = pc.id
GROUP BY ph.winner_id, pc.equb_id;

-- ============================================================================
-- SAMPLE QUERIES FOR COMMON OPERATIONS
-- ============================================================================

/*
-- QUERY 1: Get eligible members for lottery draw
SELECT 
    mes.member_id,
    pc.pool_amount,
    mes.last_payment_date
FROM member_eligibility_status mes
JOIN payout_cycles pc ON mes.payout_cycle_id = pc.id
WHERE 
    pc.id = 'CYCLE_UUID_HERE'
    AND mes.has_paid_contribution = TRUE
    AND mes.is_past_winner = FALSE
    AND mes.has_opted_out = FALSE
ORDER BY mes.last_payment_date ASC;

-- QUERY 2: Check if member is past winner in current cycle
SELECT 
    mes.member_id,
    mes.is_past_winner,
    mes.has_paid_contribution,
    ws.selected_at,
    ws.selection_method
FROM member_eligibility_status mes
LEFT JOIN winner_selections ws ON mes.payout_cycle_id = ws.payout_cycle_id 
    AND mes.member_id = ws.winner_id
WHERE 
    mes.payout_cycle_id = 'CYCLE_UUID_HERE'
    AND mes.member_id = 'MEMBER_UUID_HERE';

-- QUERY 3: Get top Prime bidders by rank
SELECT 
    por.member_id,
    por.bid_amount,
    por.fee_percentage,
    (por.bid_amount * (1 - por.fee_percentage / 100)) as net_payout,
    por.priority_rank,
    por.status
FROM prime_option_requests por
WHERE 
    por.payout_cycle_id = 'CYCLE_UUID_HERE'
    AND por.status IN ('PENDING', 'APPROVED')
ORDER BY por.priority_rank ASC
LIMIT 10;

-- QUERY 4: Get FCFS sequential order by payment date
SELECT 
    mes.member_id,
    mes.last_payment_date,
    ROW_NUMBER() OVER (ORDER BY mes.last_payment_date ASC) as fcfs_position,
    pc.pool_amount
FROM member_eligibility_status mes
JOIN payout_cycles pc ON mes.payout_cycle_id = pc.id
WHERE 
    pc.id = 'CYCLE_UUID_HERE'
    AND pc.payout_model = 'FCFS'
    AND mes.has_paid_contribution = TRUE
    AND mes.has_opted_out = FALSE
ORDER BY mes.last_payment_date ASC;

-- QUERY 5: Calculate net payout after fees and verify
SELECT 
    ph.id,
    ph.winner_id,
    ph.pot_amount,
    ph.fee_charged,
    ph.net_amount,
    (ph.pot_amount - ph.net_amount) as calculated_fee,
    CASE 
        WHEN (ph.pot_amount - ph.net_amount) = ph.fee_charged THEN 'VERIFIED'
        ELSE 'MISMATCH'
    END as fee_verification,
    ph.status
FROM payout_history ph
WHERE ph.payout_cycle_id = 'CYCLE_UUID_HERE';

-- QUERY 6: Get member's complete payout history with verification status
SELECT 
    ph.id,
    ph.payout_cycle_id,
    ph.pot_amount,
    ph.net_amount,
    ph.status,
    ph.disbursed_at,
    ph.payment_reference,
    pv.verification_type,
    pv.verification_status,
    dr.status as dispute_status
FROM payout_history ph
LEFT JOIN payout_verification pv ON ph.id = pv.payout_history_id
LEFT JOIN dispute_resolution dr ON ph.id = dr.payout_history_id
WHERE ph.winner_id = 'MEMBER_UUID_HERE'
ORDER BY ph.created_at DESC;

-- QUERY 7: Dashboard - Payout cycle summary by model
SELECT 
    pc.payout_model,
    COUNT(*) as total_cycles,
    COUNT(DISTINCT CASE WHEN pc.status = 'OPEN' THEN pc.id END) as open_cycles,
    COUNT(DISTINCT CASE WHEN pc.status = 'DRAWING' THEN pc.id END) as drawing_cycles,
    COUNT(DISTINCT CASE WHEN pc.status = 'DISBURSED' THEN pc.id END) as completed_cycles,
    SUM(pc.pool_amount) as total_pool_value,
    SUM(CASE WHEN ph.status = 'COMPLETED' THEN ph.net_amount ELSE 0 END) as total_disbursed
FROM payout_cycles pc
LEFT JOIN payout_history ph ON pc.id = ph.payout_cycle_id
GROUP BY pc.payout_model;

-- QUERY 8: Identify pending verifications (risk management)
SELECT 
    pv.id,
    pv.winner_id,
    pv.verification_type,
    pv.verification_status,
    ph.pot_amount,
    ph.status as payout_status,
    AGE(CURRENT_TIMESTAMP, pv.created_at) as pending_duration
FROM payout_verification pv
JOIN payout_history ph ON pv.payout_history_id = ph.id
WHERE pv.verification_status = 'PENDING'
ORDER BY pv.created_at ASC;

-- QUERY 9: Get unresolved disputes
SELECT 
    dr.id,
    dr.payout_history_id,
    dr.raised_by_member_id,
    dr.dispute_reason,
    dr.status,
    dr.amount_disputed,
    ph.pot_amount,
    AGE(CURRENT_TIMESTAMP, dr.created_at) as dispute_age
FROM dispute_resolution dr
JOIN payout_history ph ON dr.payout_history_id = ph.id
WHERE dr.status IN ('OPEN', 'INVESTIGATING', 'APPEALED')
ORDER BY dr.created_at ASC;

-- QUERY 10: Member reminder status
SELECT 
    pr.member_id,
    pr.reminder_type,
    pr.status,
    COUNT(*) as reminder_count,
    MAX(pr.sent_at) as last_sent,
    SUM(pr.retry_count) as total_retries
FROM payment_reminders pr
WHERE pr.status IN ('PENDING', 'FAILED')
GROUP BY pr.member_id, pr.reminder_type, pr.status
ORDER BY pr.member_id;
*/

-- ============================================================================
-- SECURITY & AUDIT FUNCTIONS
-- ============================================================================

-- Function to encrypt sensitive account information
CREATE OR REPLACE FUNCTION encrypt_account_info(
    account_number TEXT,
    account_holder_name TEXT
)
RETURNS TABLE(
    account_encrypted TEXT,
    account_iv TEXT,
    name_encrypted TEXT,
    name_iv TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        encode(pgp_sym_encrypt(account_number, current_setting('app.encryption_key')), 'hex'),
        gen_random_bytes(16)::text,
        encode(pgp_sym_encrypt(account_holder_name, current_setting('app.encryption_key')), 'hex'),
        gen_random_bytes(16)::text;
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt account information
CREATE OR REPLACE FUNCTION decrypt_account_info(
    encrypted_account TEXT,
    encrypted_name TEXT
)
RETURNS TABLE(
    account_number TEXT,
    account_holder_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pgp_sym_decrypt(decode(encrypted_account, 'hex'), current_setting('app.encryption_key'))::text,
        pgp_sym_decrypt(decode(encrypted_name, 'hex'), current_setting('app.encryption_key'))::text;
END;
$$ LANGUAGE plpgsql;

-- Audit trigger for winner selections
CREATE OR REPLACE FUNCTION audit_winner_selection()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_at
    ) VALUES (
        'winner_selections',
        NEW.id::text,
        'INSERT',
        NULL,
        row_to_json(NEW),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit trigger for payout status changes
CREATE OR REPLACE FUNCTION audit_payout_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            changed_at
        ) VALUES (
            'payout_history',
            NEW.id::text,
            'UPDATE',
            jsonb_build_object('status', OLD.status, 'updated_at', OLD.updated_at),
            jsonb_build_object('status', NEW.status, 'updated_at', NEW.updated_at),
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trg_audit_winner_selection
AFTER INSERT ON winner_selections
FOR EACH ROW
EXECUTE FUNCTION audit_winner_selection();

CREATE TRIGGER trg_audit_payout_status
BEFORE UPDATE ON payout_history
FOR EACH ROW
EXECUTE FUNCTION audit_payout_status_change();

-- ============================================================================
-- DATA RELATIONSHIPS DIAGRAM (ASCII)
-- ============================================================================
/*

                            PAYOUT_CYCLES (Master)
                         id | equb_id | round | pool | model | status
                                  |
                    ______________|_______________________________
                    |             |              |               |
                    |             |              |               |
                    v             v              v               v
          MEMBER_ELIGIBILITY  WINNER_SELECTIONS  PRIME_OPTION  PAYOUT_HISTORY
              STATUS             REQUESTS
          (Track eligibility) (Audit trail)   (Bidding)      (Transactions)
              |                   |              |              |
              |                   |              |              |_________
              |                   |              |                        |
              |___________________|______________|                        |
                    |                                                      |
                    v                                                      v
                [Members must be]                              PAYOUT_VERIFICATION
             [eligible + paid fees]                           (Risk management)
              [before drawing]                                    |
                                                   _______________|_______________
                                                   |               |             |
                                                   v               v             v
                                            DISPUTE_RESOLUTION  PAYMENT_REMINDERS
                                            (Conflict mgmt)    (Notifications)

KEY RELATIONSHIPS:
- payout_cycles.id → FK in all transaction tables
- payout_history.payout_cycle_id + winner_id (UNIQUE)
- winner_selections.payout_cycle_id (UNIQUE) - one winner per cycle
- payout_verification.payout_history_id → links to completed payouts
- dispute_resolution.payout_history_id → links to disputed payouts
- member_eligibility_status.payout_cycle_id + member_id (UNIQUE)
- prime_option_requests.payout_cycle_id + member_id (UNIQUE)

SELECTION MODEL FLOW:

LOTTERY:
  1. Query v_eligible_members_for_draw
  2. Perform random selection
  3. Insert into winner_selections with prng_seed
  4. Insert into payout_history
  5. Create verification record

PRIME:
  1. Members submit bids (prime_option_requests)
  2. Query v_top_prime_bidders ordered by priority_rank
  3. Select first available approved bid
  4. Insert into winner_selections
  5. Mark prime_option_requests.status = 'USED'
  6. Insert into payout_history with fee_percentage applied

FCFS:
  1. Get members ordered by last_payment_date (first to pay)
  2. Select first eligible member
  3. Insert into winner_selections
  4. Insert into payout_history
  5. Mark member as past_winner in eligibility_status

*/

-- ============================================================================
-- END OF SCHEMA DEFINITION
-- ============================================================================
