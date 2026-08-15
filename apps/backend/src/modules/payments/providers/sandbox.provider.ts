/**
 * sandbox.provider.ts
 *
 * Development / test payment provider. Used whenever PAYMENT_MODE=sandbox.
 *
 * It never contacts a real gateway:
 *  - Checkout returns a deterministic local checkout URL.
 *  - Transaction verification always confirms what the webhook claimed
 *    (amount parity is still enforced against expectedAmount).
 *  - Signature verification is permissive in sandbox so the dev flow works
 *    without provisioning gateway secrets.
 *
 * This is the safe default until QAL has merchant accounts, production
 * credentials and approved callback URLs (Tier 3, Phase 3.1/3.2).
 */

import { Injectable } from '@nestjs/common';

import {
    CheckoutRequest,
    CheckoutResponse,
    PaymentProvider,
    VerifyTransactionRequest,
    VerifyTransactionResponse,
} from './payment-provider.interface';

const SANDBOX_CHECKOUT_BASE = process.env.SANDBOX_CHECKOUT_BASE ?? '/checkout';

@Injectable()
export class SandboxPaymentProvider implements PaymentProvider {
    readonly name = 'sandbox' as const;

    async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
        return {
            checkoutUrl: `${SANDBOX_CHECKOUT_BASE}/${request.txRef}`,
            providerReference: `SANDBOX-${request.txRef}`,
        };
    }

    async verifyTransaction(
        request: VerifyTransactionRequest,
    ): Promise<VerifyTransactionResponse> {
        const amountMismatch =
            request.expectedAmount !== undefined &&
            request.expectedAmount !== request.amount;

        return {
            status: amountMismatch ? 'failed' : 'success',
            verified: !amountMismatch,
            amount: request.amount ?? 0,
            currency: request.currency ?? 'ETB',
            txRef: request.txRef,
            providerReference: request.providerReference,
            failureReason: amountMismatch
                ? `Amount mismatch: expected ${request.expectedAmount}, got ${request.amount}.`
                : undefined,
        };
    }

    async verifyWebhookSignature(
        _rawBody: Buffer,
        _signature: string,
    ): Promise<boolean> {
        // Sandbox mode is permissive — production requires real secrets.
        return true;
    }
}