/**
 * chapa.provider.ts
 *
 * Chapa collection gateway (https://chapa.co).
 *
 * Live mode (PAYMENT_MODE=live):
 *  - createCheckout  → POST /v1/transaction/initialize with the merchant secret
 *  - verifyTransaction → GET /v1/transaction/verify/:tx_ref
 *  - verifyWebhookSignature → HMAC-SHA256 over the raw request body
 *
 * Sandbox mode is NOT used here — the PaymentProviderService resolves the
 * SandboxPaymentProvider instead, so this class only ever runs against Chapa.
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

const CHAPA_API_BASE =
    process.env.CHAPA_API_BASE ?? 'https://api.chapa.co/v1';
const CHAPA_CHECKOUT_BASE =
    process.env.CHAPA_CHECKOUT_BASE ?? 'https://checkout.chapa.co/checkout/payment';

@Injectable()
export class ChapaPaymentProvider implements PaymentProvider {
    readonly name = 'chapa' as const;

    private readonly logger = new Logger(ChapaPaymentProvider.name);

    async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
        const secretKey = await this.getSecretKey();

        try {
            const response = await fetch(
                `${CHAPA_API_BASE}/transaction/initialize`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${secretKey}`,
                    },
                    body: JSON.stringify({
                        amount: String(request.amount),
                        currency: request.currency,
                        tx_ref: request.txRef,
                        callback_url: request.callbackUrl,
                        metadata: request.metadata,
                    }),
                },
            );

            const data = (await response.json()) as {
                status?: string;
                data?: { checkout_url?: string };
                message?: string;
            };

            if (!response.ok || data.status !== 'success') {
                throw new Error(
                    `Chapa initialize failed: ${data.message ?? response.status}`,
                );
            }

            return {
                checkoutUrl:
                    data.data?.checkout_url ?? `${CHAPA_CHECKOUT_BASE}/${request.txRef}`,
            };
        } catch (err: unknown) {
            this.logger.warn(
                `[Chapa] Checkout init error, falling back to redirect URL: ${(err as Error).message}`,
            );
            return { checkoutUrl: `${CHAPA_CHECKOUT_BASE}/${request.txRef}` };
        }
    }

    async verifyTransaction(
        request: VerifyTransactionRequest,
    ): Promise<VerifyTransactionResponse> {
        const secretKey = await this.getSecretKey();

        const response = await fetch(
            `${CHAPA_API_BASE}/transaction/verify/${request.txRef}`,
            {
                headers: { Authorization: `Bearer ${secretKey}` },
            },
        );

        const data = (await response.json()) as {
            status?: string;
            data?: { status?: string; amount?: string | number; currency?: string; reference?: string };
            message?: string;
        };

        if (!response.ok || data.status !== 'success') {
            return {
                status: 'failed',
                verified: false,
                amount: 0,
                currency: 'ETB',
                txRef: request.txRef,
                failureReason: `Chapa verification failed: ${data.message ?? response.status}`,
            };
        }

        const gatewayStatus = data.data?.status;
        const gatewayAmount = parseFloat(String(data.data?.amount ?? '0'));

        const amountMismatch =
            request.expectedAmount !== undefined &&
            Math.abs(gatewayAmount - request.expectedAmount) > 0.01;

        return {
            status: gatewayStatus === 'success' ? 'success' : 'pending',
            verified: gatewayStatus === 'success' && !amountMismatch,
            amount: gatewayAmount,
            currency: data.data?.currency ?? 'ETB',
            txRef: request.txRef,
            providerReference: data.data?.reference,
            failureReason: amountMismatch
                ? `Amount mismatch: expected ${request.expectedAmount}, verified ${gatewayAmount}.`
                : undefined,
        };
    }

    async verifyWebhookSignature(
        rawBody: Buffer,
        signature: string,
    ): Promise<boolean> {
        const expected = crypto
            .createHmac('sha256', await this.getSecretKey())
            .update(rawBody)
            .digest('hex');

        if (expected !== signature) {
            throw new BadRequestException('Invalid Chapa webhook signature.');
        }
        return true;
    }

    private async getSecretKey(): Promise<string> {
        const secrets = await VaultConfig.load();
        return secrets.CHAPA_SECRET_KEY;
    }
}