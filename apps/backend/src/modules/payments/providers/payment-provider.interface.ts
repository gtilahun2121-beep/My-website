/**
 * payment-provider.interface.ts
 *
 * Tier 3 — Payment Provider Abstraction (spec recommendation).
 *
 * The QAL system must never couple its core Equb logic to a single payment
 * gateway. Every collection gateway (Chapa, Telebirr, …) implements this
 * contract so switching providers is a configuration change, not a rewrite.
 *
 *   PaymentService
 *        │
 *        ├── ChapaPaymentProvider
 *        ├── TelebirrPaymentProvider
 *        └── SandboxPaymentProvider   (development / tests)
 *
 * Two modes exist:
 *   PAYMENT_MODE=sandbox  → everything is mocked (default, safe for dev)
 *   PAYMENT_MODE=live     → real gateway API calls + HMAC verification
 */

export type PaymentProviderName = 'chapa' | 'telebirr' | 'dashen_bank' | 'wallet' | 'sandbox';

export interface CheckoutRequest {
    /** Amount charged to the member, in ETB. */
    amount: number;
    currency: string;
    /** QAL-generated unique transaction reference. */
    txRef: string;
    /** Redirect URL the gateway sends the member back to after payment. */
    callbackUrl?: string;
    /** Gateway metadata (equb, round, member) for reconciliation. */
    metadata?: Record<string, unknown>;
}

export interface CheckoutResponse {
    /** URL the member is redirected to in order to complete payment. */
    checkoutUrl: string;
    /** Gateway-side reference (if known before the member pays). */
    providerReference?: string;
}

export type ProviderTransactionStatus = 'success' | 'failed' | 'pending';

export interface VerifyTransactionRequest {
    /** QAL transaction reference that was sent to the gateway. */
    txRef: string;
    /** Expected amount — used to reject partial / tampered payments. */
    expectedAmount?: number;
    /** Gateway-side reference returned in a webhook, when present. */
    providerReference?: string;
    /** Amount reported by the webhook — falls back to this when the gateway
     *  verify call is unavailable. */
    amount?: number;
    currency?: string;
}

export interface VerifyTransactionResponse {
    status: ProviderTransactionStatus;
    verified: boolean;
    amount: number;
    currency: string;
    txRef: string;
    providerReference?: string;
    failureReason?: string;
}

/**
 * Contract every collection provider implements.
 */
export interface PaymentProvider {
    readonly name: PaymentProviderName;

    /** Initiates a checkout session and returns the redirect URL. */
    createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;

    /**
     * Verifies a transaction with the gateway. This is the ONLY trusted source
     * of truth — webhooks are advisory, verification is authoritative.
     */
    verifyTransaction(
        request: VerifyTransactionRequest,
    ): Promise<VerifyTransactionResponse>;

    /**
     * Validates the HMAC signature on an incoming webhook.
     * Returns true when the signature matches the gateway's secret.
     */
    verifyWebhookSignature(
        rawBody: Buffer,
        signature: string,
    ): Promise<boolean>;
}