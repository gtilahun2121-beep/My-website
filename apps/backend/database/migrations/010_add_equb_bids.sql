-- =========================================================================
-- QALNET MIGRATION 010 - REAL BIDDING AUCTION LEDGER
--
-- Replaces the audit_logs workaround used by POST /api/v1/equbs/:id/bid
-- with a first-class table. Auction model (spec §3.4):
--
--   P_winner = V_base - B_r        winner receives the pot minus their bid
--   D_r      = B_r / (N - 1)       bid redistributed to remaining members
--
-- One bid per (equb, round, member) -- later bids raise the standing bid.
-- Every statement is guarded so this migration is idempotent and safe to
-- re-run.
-- =========================================================================

CREATE TABLE IF NOT EXISTS equb_bids (
    id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    equb_id          UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE CASCADE,
    user_id          UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    round_number     INTEGER        NOT NULL CHECK (round_number > 0),
    bid_amount       NUMERIC(15, 2) NOT NULL CHECK (bid_amount > 0.00),
    potential_payout NUMERIC(15, 2) NOT NULL CHECK (potential_payout > 0.00),
    status           TEXT           NOT NULL DEFAULT 'open'
                                     CHECK (status IN ('open', 'winning', 'outbid', 'settled')),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (equb_id, round_number, user_id)
);

-- Resolution queries: the highest bid for a round
CREATE INDEX IF NOT EXISTS idx_equb_bids_round
  ON equb_bids (equb_id, round_number);

-- Standing bids per member (already covered by the UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_equb_bids_member
  ON equb_bids (user_id);