/**
 * payout-provider.interface.ts
 *
 * Tier 3 — Disbursement provider abstraction (spec recommendation).
 *
 * Payouts must never be coupled to one bank or aggregator. Every disbursement
 * channel (Bank A, Bank B, Provider C, …) implements this contract:
 *
 *   PayoutService
 *        │
 *        ├── SandboxBankProvider     (development / tests — always succeeds)
 *        └── <future> BankProvider   (CBE Birr B2C, Telebirr B2C, …)
 *
 * Modes:
 *   PAYOUT_MODE=sandbox  → SandboxBankProvider (default, safe for dev)
 *   PAYOUT_MODE=live     → the registered real provider
 */

export interface DisburseRequest {
    /** Amount to send the winner, in ETB. */
    amount: number;
    currency: string;
    recipientName: string;
    recipientPhone: string;
    /** QAL-generated unique payout reference. */
    reference: string;
    metadata?: Record<string, unknown>;
}

export interface DisburseResponse {
    success: boolean;
    /** Gateway-side transaction reference on success. */
    reference?: string;
    failureReason?: string;
}

export interface PayoutProvider {
    readonly name: string;

    /** Sends money to the winner's account. */
    disburse(request: DisburseRequest): Promise<DisburseResponse>;
}