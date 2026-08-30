/**
 * Payments & Equb-related shared types.
 *
 * These mirror the backend DTOs and controller contracts EXACTLY.
 * Changes here must be kept in sync with:
 *   - apps/backend/src/modules/payments/dto/checkout.dto.ts
 *   - apps/backend/src/modules/payments/dto/bid.dto.ts
 *   - apps/backend/src/modules/payments/dto/webhook.dto.ts
 *   - apps/backend/src/modules/payments/payments.controller.ts
 */

// ── Payment Methods ───────────────────────────────────────────────────────────

/** Matches the backend PaymentMethod enum in checkout.dto.ts */
export type PaymentMethod = 'wallet' | 'chapa' | 'telebirr';

// ── Checkout ──────────────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/payments/checkout.
 * All fields are snake_case to match the backend CheckoutDto directly.
 */
export interface CheckoutRequest {
    equb_id: string;                // UUID of the Equb group
    round_number: number;           // Which round this payment covers (> 0)
    payment_method: PaymentMethod;  // 'wallet' | 'chapa' | 'telebirr'
    callback_url?: string;          // Redirect URL for Chapa/Telebirr after payment
}

// ── Pending Payments ──────────────────────────────────────────────────────────

/**
 * Query params for GET /api/v1/payments/pending.
 * Returns outstanding payment objects for the active round.
 */
export interface GetPendingPaymentsParams {
    equb_id: string;   // UUID of the Equb group
    round: number;     // Round number to fetch pending payments for
}

// ── Bidding ───────────────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/equbs/:id/bid.
 * equb_id is taken from the URL param; only bid_amount is in the body.
 *
 * Bidding auction formula (spec §3.4):
 *   P_winner = V_base − bid_amount
 *   D_r      = bid_amount / (N − 1)   redistributed to remaining members
 */
export interface BidRequest {
    equb_id: string;    // Injected from URL param by the controller
    bid_amount: number; // ETB amount to bid (must be > 0)
}

/** A standing bid on the auction leaderboard (joined with the bidder's name). */
export interface BidRecord {
    id: string;
    equb_id: string;
    user_id: string;
    round_number: number;
    bid_amount: number;
    potential_payout: number;
    status: 'open' | 'winning' | 'outbid' | 'settled';
    created_at: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
}

/** Response from POST /api/v1/equbs/:id/bid */
export interface SubmitBidResponse {
    bid_recorded: boolean;
    bid_id: string;
    round_number: number;
    potential_payout: number;
    updated: boolean;
    message: string;
}

/** Response from GET /api/v1/equbs/:id/bids?round=N */
export interface RoundBidListResponse {
    items: BidRecord[];
    total: number;
    round_number: number;
}

/** Response from POST /api/v1/equbs/:id/auction/resolve */
export interface AuctionResolutionResponse {
    round_number: number;
    winner: LotteryCandidate;
    bid_amount: number;
    payout_amount: number;
    redistributed_share: number;
    total_bids: number;
    already_resolved: boolean;
    message: string;
}

// ── Webhook ───────────────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/payments/webhook.
 * Called by Chapa or Telebirr payment processors; HMAC-verified.
 */
export interface PaymentWebhookPayload {
    transaction_reference: string;      // Unique transaction reference from processor
    status: 'success' | 'failed' | 'pending';
    amount: number;                     // Amount in ETB
    provider: 'chapa' | 'telebirr';
    metadata?: Record<string, unknown>;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletBalance {
    userId: string;
    balance: number;
    currency: string; // 'ETB'
}

// ── Lottery Draws ─────────────────────────────────────────────────────────────

/**
 * A single eligible lottery participant (approved member who paid the round).
 * Matches the backend LotteryCandidate shape.
 */
export interface LotteryCandidate {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
}

/**
 * Response from POST /api/v1/equbs/:id/draws.
 * The winner + full candidate list let the client animate a fair spinning
 * wheel that lands on the actual winner.
 */
export interface LotteryDrawResponse {
    draw: {
        id: string;
        equb_id: string;
        round_number: number;
        winner_id: string;
        draw_timestamp: string;
    };
    winner: LotteryCandidate;
    candidates: LotteryCandidate[];
    message: string;
}

/** One historical draw row, joined with the winner's name. */
export interface LotteryDrawListItem {
    id: string;
    round_number: number;
    winner_id: string;
    draw_timestamp: string;
    winner_first_name: string;
    winner_last_name: string;
    winner_phone: string;
}

/** Response from GET /api/v1/equbs/:id/draws */
export interface LotteryDrawListResponse {
    items: LotteryDrawListItem[];
    total: number;
    current_round: number;
    total_rounds: number;
    /** The most recent draw with the full candidate set so the wheel can
     *  render immediately on page load (no need to re-run the draw). */
    latest_draw: {
        draw: {
            id: string;
            equb_id: string;
            round_number: number;
            winner_id: string;
            draw_timestamp: string;
        };
        winner: LotteryCandidate;
        candidates: LotteryCandidate[];
    } | null;
}
