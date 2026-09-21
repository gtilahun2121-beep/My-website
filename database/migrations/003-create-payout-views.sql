-- QalNet Payout System - Reporting Views
-- PostgreSQL Migrations
-- Created: August 29, 2026

-- ============================================================================
-- View 1: Eligible Members for Current Cycle
-- Used for: Winner selection, eligibility verification
-- ============================================================================
CREATE OR REPLACE VIEW v_eligible_members_for_cycle AS
SELECT 
  mes.payout_cycle_id,
  pc.equb_id,
  mes.member_id,
  u.first_name,
  u.last_name,
  u.phone,
  mes.contribution_amount,
  mes.required_amount,
  mes.contribution_status,
  mes.is_eligible,
  mes.is_past_winner,
  mes.is_excluded,
  mes.exclusion_reason,
  pc.selection_model,
  CASE 
    WHEN mes.contribution_amount >= mes.required_amount THEN 'FULL_PAID'
    WHEN mes.contribution_amount > 0 THEN 'PARTIAL_PAID'
    ELSE 'UNPAID'
  END as payment_status,
  CAST(
    (mes.contribution_amount::DECIMAL / NULLIF(mes.required_amount, 0)) * 100 
    AS DECIMAL(5, 2)
  ) as payment_percentage
FROM member_eligibility_status mes
JOIN payout_cycles pc ON mes.payout_cycle_id = pc.id
JOIN users u ON mes.member_id = u.id
WHERE pc.status IN ('active', 'selection_in_progress')
  AND mes.is_eligible = TRUE
  AND mes.is_excluded = FALSE
ORDER BY mes.contribution_amount DESC;

-- ============================================================================
-- View 2: Pending Payouts Requiring Action
-- Used for: Batch processing, payment reminders, monitoring
-- ============================================================================
CREATE OR REPLACE VIEW v_pending_payouts AS
SELECT 
  ph.id as payout_id,
  ph.payout_cycle_id,
  pc.equb_id,
  e.name as equb_name,
  pc.cycle_number,
  ph.winner_member_id,
  u.first_name,
  u.last_name,
  u.phone,
  ph.gross_amount,
  ph.fees_amount,
  ph.net_amount,
  ph.payment_provider,
  ph.payment_status,
  ph.attempt_count,
  ph.last_attempt_at,
  CURRENT_TIMESTAMP - ph.last_attempt_at as time_since_last_attempt,
  CASE 
    WHEN ph.attempt_count >= 3 THEN 'HIGH_PRIORITY'
    WHEN ph.attempt_count >= 1 THEN 'MEDIUM_PRIORITY'
    ELSE 'NORMAL_PRIORITY'
  END as priority,
  ph.recipient_account,
  ph.created_at,
  ph.completed_at
FROM payout_history ph
JOIN payout_cycles pc ON ph.payout_cycle_id = pc.id
JOIN equbs e ON pc.equb_id = e.id
JOIN users u ON ph.winner_member_id = u.id
WHERE ph.payment_status IN ('pending', 'processing', 'failed')
ORDER BY 
  CASE 
    WHEN ph.attempt_count >= 3 THEN 1
    WHEN ph.attempt_count >= 1 THEN 2
    ELSE 3
  END,
  ph.last_attempt_at ASC NULLS LAST;

-- ============================================================================
-- View 3: Default Risk Analysis
-- Used for: Risk management, preventive action planning
-- ============================================================================
CREATE OR REPLACE VIEW v_default_risk_analysis AS
SELECT 
  mes.equb_id,
  e.name as equb_name,
  mes.member_id,
  u.first_name,
  u.last_name,
  u.phone,
  mes.payout_cycle_id,
  pc.cycle_number,
  mes.contribution_amount,
  mes.required_amount,
  (mes.required_amount - mes.contribution_amount) as outstanding_amount,
  CAST(
    ((mes.required_amount - mes.contribution_amount)::DECIMAL / NULLIF(mes.required_amount, 0)) * 100
    AS DECIMAL(5, 2)
  ) as shortfall_percentage,
  CASE 
    WHEN mes.contribution_amount = 0 THEN 'AT_RISK_NO_PAYMENT'
    WHEN mes.contribution_status = 'partial' THEN 'AT_RISK_PARTIAL_PAYMENT'
    ELSE 'LOW_RISK'
  END as risk_level,
  COALESCE(pr.reminder_count, 0) as reminders_sent,
  COALESCE(pr.last_reminder_date, pc.start_date) as last_reminder,
  CURRENT_TIMESTAMP - COALESCE(pr.last_reminder_date, pc.start_date) as days_since_reminder
FROM member_eligibility_status mes
JOIN payout_cycles pc ON mes.payout_cycle_id = pc.id
JOIN equbs e ON mes.equb_id = e.id
JOIN users u ON mes.member_id = u.id
LEFT JOIN (
  SELECT payout_cycle_id, member_id, COUNT(*) as reminder_count, MAX(sent_at) as last_reminder_date
  FROM payment_reminders
  WHERE delivery_status IN ('sent', 'delivered')
  GROUP BY payout_cycle_id, member_id
) pr ON mes.payout_cycle_id = pr.payout_cycle_id AND mes.member_id = pr.member_id
WHERE mes.contribution_status IN ('unpaid', 'partial')
ORDER BY 
  CASE 
    WHEN mes.contribution_amount = 0 THEN 1
    WHEN mes.contribution_status = 'partial' THEN 2
    ELSE 3
  END,
  shortfall_percentage DESC;

-- ============================================================================
-- View 4: Winner Selection Audit Trail
-- Used for: Compliance, audit, dispute investigation
-- ============================================================================
CREATE OR REPLACE VIEW v_winner_selection_audit AS
SELECT 
  ws.id as selection_id,
  ws.payout_cycle_id,
  pc.equb_id,
  e.name as equb_name,
  pc.cycle_number,
  ws.winner_member_id,
  u.first_name,
  u.last_name,
  u.phone,
  ws.selection_model,
  ws.selection_timestamp,
  CASE 
    WHEN ws.selection_model = 'lottery' THEN 'Random draw with seed: ' || ws.seed
    WHEN ws.selection_model = 'prime_option' THEN 'Highest bid amount: ' || ws.bid_amount::TEXT
    WHEN ws.selection_model = 'fcfs' THEN 'FCFS sequence: ' || ws.request_sequence::TEXT
    ELSE 'Unknown'
  END as selection_details,
  ws.verification_hash,
  ws.verified_at,
  ws.verified_by,
  CASE WHEN ws.verified_at IS NOT NULL THEN 'VERIFIED' ELSE 'UNVERIFIED' END as verification_status,
  ws.proof_data,
  pc.total_pooled_amount,
  pc.number_of_members,
  CAST(
    (pc.total_pooled_amount / NULLIF(pc.number_of_members, 0))
    AS DECIMAL(12, 2)
  ) as average_contribution,
  ws.created_at,
  ws.updated_at
FROM winner_selections ws
JOIN payout_cycles pc ON ws.payout_cycle_id = pc.id
JOIN equbs e ON ws.equb_id = e.id
JOIN users u ON ws.winner_member_id = u.id
ORDER BY ws.selection_timestamp DESC;

-- ============================================================================
-- View 5: Fee Distribution Summary
-- Used for: Financial reporting, revenue analysis
-- ============================================================================
CREATE OR REPLACE VIEW v_fee_distribution_summary AS
SELECT 
  ph.payout_cycle_id,
  pc.equb_id,
  e.name as equb_name,
  pc.cycle_number,
  COUNT(ph.id) as total_payouts,
  SUM(ph.gross_amount) as total_gross_amount,
  SUM(ph.fees_amount) as total_fees_collected,
  SUM(ph.net_amount) as total_net_distributed,
  CAST(
    (SUM(ph.fees_amount) / NULLIF(SUM(ph.gross_amount), 0)) * 100
    AS DECIMAL(5, 2)
  ) as fee_percentage,
  AVG(ph.fees_amount) as avg_fee_per_payout,
  MIN(ph.fees_amount) as min_fee,
  MAX(ph.fees_amount) as max_fee,
  COUNT(CASE WHEN ph.payment_status = 'completed' THEN 1 END) as completed_payouts,
  COUNT(CASE WHEN ph.payment_status IN ('pending', 'processing') THEN 1 END) as pending_payouts,
  COUNT(CASE WHEN ph.payment_status = 'failed' THEN 1 END) as failed_payouts
FROM payout_history ph
JOIN payout_cycles pc ON ph.payout_cycle_id = pc.id
JOIN equbs e ON pc.equb_id = e.id
GROUP BY ph.payout_cycle_id, pc.equb_id, e.name, pc.cycle_number
ORDER BY pc.equb_id, pc.cycle_number DESC;

-- ============================================================================
-- View 6: Payment Provider Performance
-- Used for: Provider selection, SLA monitoring
-- ============================================================================
CREATE OR REPLACE VIEW v_payment_provider_performance AS
SELECT 
  ph.payment_provider,
  COUNT(ph.id) as total_transactions,
  COUNT(CASE WHEN ph.payment_status = 'completed' THEN 1 END) as successful_transactions,
  COUNT(CASE WHEN ph.payment_status = 'failed' THEN 1 END) as failed_transactions,
  CAST(
    (COUNT(CASE WHEN ph.payment_status = 'completed' THEN 1 END)::DECIMAL / 
     NULLIF(COUNT(ph.id), 0)) * 100
    AS DECIMAL(5, 2)
  ) as success_rate,
  AVG(ph.attempt_count) as avg_attempts,
  MAX(ph.attempt_count) as max_attempts,
  SUM(ph.net_amount) as total_amount_processed,
  AVG(EXTRACT(EPOCH FROM (ph.completed_at - ph.created_at)) / 3600)::DECIMAL(10, 2) as avg_processing_hours,
  MIN(ph.completed_at) as first_transaction_date,
  MAX(ph.completed_at) as last_transaction_date
FROM payout_history ph
WHERE ph.payment_status IN ('completed', 'failed')
GROUP BY ph.payment_provider
ORDER BY success_rate DESC;

-- ============================================================================
-- View 7: Dispute Statistics
-- Used for: Quality assurance, trend analysis
-- ============================================================================
CREATE OR REPLACE VIEW v_dispute_statistics AS
SELECT 
  dr.dispute_type,
  COUNT(dr.id) as total_disputes,
  COUNT(CASE WHEN dr.status = 'open' THEN 1 END) as open_disputes,
  COUNT(CASE WHEN dr.status = 'investigating' THEN 1 END) as investigating_disputes,
  COUNT(CASE WHEN dr.status = 'resolved' THEN 1 END) as resolved_disputes,
  COUNT(CASE WHEN dr.status = 'closed' THEN 1 END) as closed_disputes,
  CAST(
    (COUNT(CASE WHEN dr.status IN ('resolved', 'closed') THEN 1 END)::DECIMAL / 
     NULLIF(COUNT(dr.id), 0)) * 100
    AS DECIMAL(5, 2)
  ) as resolution_rate,
  AVG(EXTRACT(EPOCH FROM (COALESCE(dr.resolved_at, CURRENT_TIMESTAMP) - dr.opened_at)) / 86400)::DECIMAL(10, 2) as avg_resolution_days,
  MIN(dr.opened_at) as first_dispute_date,
  MAX(dr.opened_at) as last_dispute_date
FROM dispute_resolution dr
GROUP BY dr.dispute_type
ORDER BY total_disputes DESC;

-- ============================================================================
-- View 8: Cycle Status Summary
-- Used for: Dashboard, progress tracking
-- ============================================================================
CREATE OR REPLACE VIEW v_cycle_status_summary AS
SELECT 
  pc.equb_id,
  e.name as equb_name,
  pc.id as cycle_id,
  pc.cycle_number,
  pc.status as cycle_status,
  pc.selection_model,
  pc.start_date,
  pc.end_date,
  pc.selection_date,
  pc.payout_due_date,
  CASE 
    WHEN CURRENT_TIMESTAMP < pc.selection_date THEN 'CONTRIBUTION_PHASE'
    WHEN CURRENT_TIMESTAMP BETWEEN pc.selection_date AND pc.payout_start_date THEN 'SELECTION_PHASE'
    WHEN CURRENT_TIMESTAMP BETWEEN pc.payout_start_date AND pc.payout_due_date THEN 'PAYOUT_PHASE'
    ELSE 'COMPLETED_PHASE'
  END as current_phase,
  COUNT(mes.id) as total_members,
  COUNT(CASE WHEN mes.is_eligible = TRUE THEN 1 END) as eligible_members,
  COUNT(CASE WHEN mes.contribution_status = 'paid' THEN 1 END) as paid_members,
  SUM(mes.contribution_amount) as total_contributions,
  pc.total_pooled_amount as expected_amount,
  CAST(
    (SUM(mes.contribution_amount)::DECIMAL / NULLIF(pc.total_pooled_amount, 0)) * 100
    AS DECIMAL(5, 2)
  ) as collection_percentage,
  COUNT(DISTINCT ws.id) as winners_selected,
  COUNT(CASE WHEN ph.payment_status = 'completed' THEN 1 END) as completed_payouts,
  COUNT(CASE WHEN ph.payment_status IN ('pending', 'failed') THEN 1 END) as pending_payouts
FROM payout_cycles pc
JOIN equbs e ON pc.equb_id = e.id
LEFT JOIN member_eligibility_status mes ON pc.id = mes.payout_cycle_id
LEFT JOIN winner_selections ws ON pc.id = ws.payout_cycle_id
LEFT JOIN payout_history ph ON pc.id = ph.payout_cycle_id
GROUP BY pc.equb_id, e.name, pc.id, pc.cycle_number, pc.status, 
         pc.selection_model, pc.start_date, pc.end_date, 
         pc.selection_date, pc.payout_start_date, pc.payout_due_date, 
         pc.total_pooled_amount
ORDER BY e.name, pc.cycle_number DESC;

-- ============================================================================
-- View 9: Member Payment History
-- Used for: Member tracking, payment pattern analysis
-- ============================================================================
CREATE OR REPLACE VIEW v_member_payment_history AS
SELECT 
  ph.winner_member_id as member_id,
  u.first_name,
  u.last_name,
  u.phone,
  COUNT(ph.id) as total_payouts_received,
  SUM(ph.net_amount) as total_amount_received,
  AVG(ph.net_amount) as avg_payout_amount,
  COUNT(CASE WHEN ph.payment_status = 'completed' THEN 1 END) as successful_payouts,
  COUNT(CASE WHEN ph.payment_status = 'failed' THEN 1 END) as failed_payouts,
  MAX(ph.completed_at) as last_payout_date,
  MIN(ph.completed_at) as first_payout_date,
  COUNT(DISTINCT ph.payment_provider) as providers_used,
  STRING_AGG(DISTINCT ph.payment_provider, ', ' ORDER BY ph.payment_provider) as payment_providers
FROM payout_history ph
JOIN users u ON ph.winner_member_id = u.id
WHERE ph.payment_status = 'completed'
GROUP BY ph.winner_member_id, u.first_name, u.last_name, u.phone
ORDER BY total_amount_received DESC;

-- ============================================================================
-- View 10: Real-time System Health
-- Used for: Monitoring, alerting, dashboard
-- ============================================================================
CREATE OR REPLACE VIEW v_system_health_metrics AS
SELECT 
  'Total Active Cycles' as metric,
  COUNT(*)::TEXT as value,
  CURRENT_TIMESTAMP as measured_at
FROM payout_cycles
WHERE status IN ('active', 'selection_in_progress', 'payout_in_progress')

UNION ALL

SELECT 
  'Pending Payouts',
  COUNT(*)::TEXT,
  CURRENT_TIMESTAMP
FROM payout_history
WHERE payment_status IN ('pending', 'failed')

UNION ALL

SELECT 
  'Open Disputes',
  COUNT(*)::TEXT,
  CURRENT_TIMESTAMP
FROM dispute_resolution
WHERE status IN ('open', 'investigating')

UNION ALL

SELECT 
  'Overdue Contribution Reminders',
  COUNT(*)::TEXT,
  CURRENT_TIMESTAMP
FROM payment_reminders
WHERE delivery_status = 'pending' 
  AND scheduled_at <= CURRENT_TIMESTAMP

UNION ALL

SELECT 
  'High-Risk Members',
  COUNT(*)::TEXT,
  CURRENT_TIMESTAMP
FROM member_eligibility_status
WHERE contribution_status = 'unpaid' 
  AND is_eligible = FALSE

UNION ALL

SELECT 
  'Total Value Locked',
  COALESCE(SUM(total_pooled_amount)::TEXT, '0'),
  CURRENT_TIMESTAMP
FROM payout_cycles
WHERE status IN ('active', 'payout_in_progress')

ORDER BY measured_at DESC;

-- ============================================================================
-- Materialized View for High-Volume Queries (Optional - for performance)
-- Refresh: Run periodically (e.g., every hour)
-- ============================================================================
-- CREATE MATERIALIZED VIEW mv_cycle_summary_cache AS
-- SELECT * FROM v_cycle_status_summary;
-- 
-- CREATE INDEX idx_mv_cycle_summary_equb ON mv_cycle_summary_cache(equb_id);
-- 
-- -- Refresh command (run periodically):
-- -- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cycle_summary_cache;

-- ============================================================================
-- View Permissions (Optional - adjust to your security model)
-- ============================================================================
-- GRANT SELECT ON v_eligible_members_for_cycle TO read_user;
-- GRANT SELECT ON v_pending_payouts TO read_user;
-- GRANT SELECT ON v_cycle_status_summary TO read_user;
-- GRANT SELECT ON v_system_health_metrics TO read_user;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- All reporting views created successfully.
-- These views are optimized for common queries and reporting operations.
-- Next: Set up the NestJS backend layer with repositories and services.
