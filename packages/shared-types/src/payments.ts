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
