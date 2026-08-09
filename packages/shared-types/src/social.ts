/**
 * Social / Governance shared types (proposals, voting, tickets, CRB).
 *
 * These mirror the backend DTOs and controller contracts EXACTLY.
 * Changes here must be kept in sync with:
 *   - apps/backend/src/modules/social/dto/create-proposal.dto.ts
 *   - apps/backend/src/modules/social/dto/cast-vote.dto.ts
 *   - apps/backend/src/modules/social/social.controller.ts
 */

// ── Social Fund Proposals ─────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/equbs/:id/proposals.
 * Note: equb_id comes from the URL param, NOT the body.
 * The backend CreateProposalDto uses budget (ETB amount), not a list of options.
 */
export interface CreateProposalRequest {
    title: string;       // max 150 chars
    description: string; // text — describes the spending proposal
    budget: number;      // ETB amount requested from social fund (> 0)
}

/**
 * Proposal as returned by GET /api/v1/equbs/:id/proposals.
 * Matches the social_proposals DB table.
 */
export interface Proposal {
    id: string;
    equb_id: string;
    proposer_id: string;
    title: string;
    description: string;
    budget: number;
    status: 'open' | 'in_progress' | 'resolved' | 'rejected'; // ticket_status enum
    created_at: string;
}

// ── Voting ────────────────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/proposals/:id/vote.
 * This is a boolean yes/no vote, NOT an index-based option vote.
 * The backend CastVoteDto uses a boolean `vote` field (true = Approve).
 */
export interface CastVoteRequest {
    vote: boolean; // true = Approve, false = Reject
}

/** Vote tally returned after casting a vote */
export interface VoteTally {
    proposal_id: string;
    approve_count: number;
    reject_count: number;
    total_members: number;
    quorum_reached: boolean;
    resolved_status?: 'in_progress' | 'rejected'; // set when quorum is reached
}

// ── Reconciliation Tickets ────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/tickets.
 * Files a payment dispute or reconciliation ticket.
 */
export interface FileTicketRequest {
    transaction_reference: string; // Unique transaction ref from the payment processor
    reported_amount: number;       // Amount in ETB that was reported (> 0)
    payment_id?: string;           // Optional: UUID of the related payment record
}

/**
 * Ticket as returned by GET /api/v1/tickets/mine.
 * Matches the reconciliation_tickets DB table.
 */
export interface ReconciliationTicket {
    id: string;
    user_id: string;
    payment_id: string | null;
    transaction_reference: string;
    reported_amount: number;
    status: 'open' | 'in_progress' | 'resolved' | 'rejected';
    assigned_admin_id: string | null;
    notes: string | null;
    resolved_at: string | null;
    created_at: string;
}

// ── CRB (Admin Only) ──────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/admin/crb/flag (Admin only).
 * Flags a defaulting member on the CRB blacklist.
 */
export interface FlagCrbRequest {
    user_id: string; // UUID of the user to flag
    reason: string;  // Explanation for the flag
}
