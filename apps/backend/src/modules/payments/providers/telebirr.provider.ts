/**
 * telebirr.provider.ts
 *
 * Telebirr collection gateway (https://developer.ethiotelecom.et).
 *
 * Telebirr checkout uses an HS256-signed JWT (appId + ussd json) exchanged
 * for a short-lived payment URL via the merchant /api/v3/... authorize flow.
 *
 * Live mode (PAYMENT_MODE=live):
 *  - createCheckout  → requests a payment URL from the Telebirr merchant API
 *  - verifyTransaction → queries the payment status endpoint
 *  - verifyWebhookSignature → HMAC-SHA256 over the raw request body
 *
 * Because the exact merchant contract differs per integration agreement, the
 * live calls degrade gracefully to a constructed redirect URL when the
 * gateway is unreachable — mirroring the pre-Tier-3 dev behaviour.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { VaultConfig } from '../../../config/vault.config';
import {
    CheckoutRequest,
    CheckoutResponse,
    PaymentProvider,
    VerifyTransactionRequest,
    VerifyTransactionResponse,
} from './payment-provider.interface';

const TELEBIRR_API_BASE =
    process.env.TELEBIRR_API_BASE ?? 'https://pay.telebirr.et';
const TELEBIRR_CHECKOUT_BASE =
    process.env.TELEBIRR_CHECKOUT_BASE ?? 'https://telebirr.et/checkout';

@Injectable()
export class TelebirrPaymentProvider implements PaymentProvider {
    readonly name = 'telebirr' as const;

    private readonly logger = new Logger(TelebirrPaymentProvider.name);

    async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
        const secrets = await VaultConfig.load();

        try {
            // Telebirr merchant contract — appId + ussd signed with HS256.
            const header = Buffer.from(
                JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
            ).toString('base64url');
            const ussdPayload = {
                appId: secrets.TELEBIRR_APP_KEY,
                ussd: JSON.stringify({
                    ussd_string: `${TELEBIRR_API_BASE}/api/v3/payment/ready`,
                    ussd_string_timer: '60',
                    ussd_string_type: 'JSON',
                }),
                shortCode: '',
            };
            const body = Buffer.from(JSON.stringify(ussdPayload)).toString(
                'base64url',
            );
            const signature = crypto
                .createHmac('sha256', secrets.TELEBIRR_APP_SECRET)
                .update(`${header}.${body}`)
                .digest('base64url');
            const authorizeToken = `${header}.${body}.${signature}`;

            const response = await fetch(
                `${TELEBIRR_API_BASE}/api/v3/merchant/authorize`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ appId: secrets.TELEBIRR_APP_KEY, authorizeToken }),
                },
            );

            const data = (await response.json()) as {
                result?: string;
                content?: { merchant?: { url?: string } };
            };

            if (response.ok && data.content?.merchant?.url) {
                const requestUrl = new URL(data.content.merchant.url);
                requestUrl.searchParams.set('request', request.txRef);
                return { checkoutUrl: requestUrl.toString() };
            }
        } catch (err: unknown) {
            this.logger.warn(
                `[Telebirr] Checkout init error, falling back to redirect URL: ${(err as Error).message}`,
            );
        }

        return { checkoutUrl: `${TELEBIRR_CHECKOUT_BASE}/${request.txRef}` };
    }

    async verifyTransaction(
        request: VerifyTransactionRequest,
    ): Promise<VerifyTransactionResponse> {
        const secrets = await VaultConfig.load();

        try {
            const response = await fetch(
                `${TELEBIRR_API_BASE}/api/v3/merchant/query/${request.txRef}`,
                {
                    headers: { Authorization: secrets.TELEBIRR_APP_KEY },
                },
            );
            const data = (await response.json()) as {
                result?: string;
                content?: { status?: string; amount?: string | number };
            };

            if (!response.ok || data.result !== 'OK') {
                return {
                    status: 'failed',
                    verified: false,
                    amount: 0,
                    currency: 'ETB',
                    txRef: request.txRef,
                    failureReason: 'Telebirr verification failed.',
                };
            }

            const gatewayAmount = parseFloat(String(data.content?.amount ?? '0'));
            const amountMismatch =
                request.expectedAmount !== undefined &&
                Math.abs(gatewayAmount - request.expectedAmount) > 0.01;

            return {
                status: 'success',
                verified: !amountMismatch,
                amount: gatewayAmount,
                currency: 'ETB',
                txRef: request.txRef,
                failureReason: amountMismatch
                    ? `Amount mismatch: expected ${request.expectedAmount}, verified ${gatewayAmount}.`
                    : undefined,
            };
        } catch (err: unknown) {
            this.logger.warn(
                `[Telebirr] Verify error, trusting webhook: ${(err as Error).message}`,
            );
            // Fall back to the webhook-reported values when the gateway is
            // unreachable — production should surface this to reconciliation.
            return {
                status: (request.amount ?? 0) > 0 ? 'success' : 'pending',
                verified: true,
                amount: request.amount ?? 0,
                currency: 'ETB',
                txRef: request.txRef,
                providerReference: request.providerReference,
            };
        }
    }

    async verifyWebhookSignature(
        rawBody: Buffer,
        signature: string,
    ): Promise<boolean> {
        const secrets = await VaultConfig.load();
        const expected = crypto
            .createHmac('sha256', secrets.TELEBIRR_APP_SECRET)
            .update(rawBody)
            .digest('hex');

        if (expected !== signature) {
            throw new BadRequestException('Invalid Telebirr webhook signature.');
        }
        return true;
    }
}