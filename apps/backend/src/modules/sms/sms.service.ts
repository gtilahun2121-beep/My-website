/**
 * sms.service.ts
 *
 * Delivers SMS via the AfricasTalking REST API.
 *
 * Configuration (environment variables, optional in dev):
 *   AT_USERNAME  — AfricasTalking username (default "sandbox")
 *   AT_API_KEY   — AfricasTalking API key (live or sandbox)
 *   AT_SENDER_ID — sender ID / short code (default "QALNET")
 *
 * Delivery model:
 *   - When AT_API_KEY is present the code is actually sent to the phone.
 *   - When it is absent:
 *       * in development the caller falls back to returning the code
 *         as `dev_otp` so the flow stays testable offline; and
 *       * in production send() throws so a missing gateway fails loudly
 *         instead of silently swallowing the OTP.
 *
 * Note: sandbox mode only delivers to phone numbers registered inside the
 * AfricasTalking sandbox dashboard; use a live API key for real numbers.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface SmsResult {
    delivered: boolean;
    providerMessageId?: string;
    error?: string;
}

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    private readonly apiKey = process.env.AT_API_KEY ?? '';
    private readonly username = process.env.AT_USERNAME ?? 'sandbox';
    private readonly from = process.env.AT_SENDER_ID ?? 'QALNET';
    private readonly isProduction = process.env.NODE_ENV === 'production';

    /** True when an API key is configured so a real SMS can be delivered. */
    get configured(): boolean {
        return this.apiKey.length > 0;
    }

    /**
     * Sends a 6-digit verification code. Returns whether delivery succeeded.
     */
    async sendVerificationCode(phone: string, code: string): Promise<SmsResult> {
        const message =
            `Your QalNet verification code is ${code}. It expires in 10 minutes. ` +
            `Do not share this code with anyone.`;
        return this.send(phone, message);
    }

    /**
     * Sends an arbitrary SMS message to `phone`.
     */
    async send(phone: string, message: string): Promise<SmsResult> {
        if (!this.configured) {
            if (this.isProduction) {
                throw new Error(
                    '[SmsService] AT_API_KEY is not configured but production delivery was requested.',
                );
            }
            this.logger.warn(
                `[SmsService] No AT_API_KEY configured — SMS not sent to ${phone} (dev fallback enabled).`,
            );
            return { delivered: false };
        }

        const to = this.normalizePhone(phone);

        const body = new URLSearchParams({
            username: this.username,
            to,
            message,
            from: this.from,
        });

        try {
            const res = await fetch('https://api.africastalking.com/version1/messaging', {
                method: 'POST',
                headers: {
                    apiKey: this.apiKey,
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            });

            const data = (await res.json().catch(() => null)) as
                | { SMSMessageData?: { Recipients?: { status?: string; messageId?: string; message?: string }[]; Message?: string } }
                | null;

            const recipient = data?.SMSMessageData?.Recipients?.[0];
            const status = recipient?.status ?? 'Unknown';

            if (!res.ok || status !== 'Success') {
                const detail =
                    recipient?.message ??
                    data?.SMSMessageData?.Message ??
                    `HTTP ${res.status}`;
                this.logger.error(`[SmsService] AfricasTalking delivery failed: ${detail}`);
                return { delivered: false, error: detail };
            }

            this.logger.log(`[SmsService] SMS delivered to ${to} (${recipient?.messageId})`);
            return { delivered: true, providerMessageId: recipient?.messageId };
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            this.logger.error(`[SmsService] Delivery error: ${detail}`);
            return { delivered: false, error: detail };
        }
    }

    /**
     * Converts local/Ethiopian formats to E.164 digits for AfricasTalking,
     * e.g. "+251912345678" or "0912345678" → "251912345678".
     */
    private normalizePhone(phone: string): string {
        let p = phone.replace(/[^\d]/g, '');
        if (p.startsWith('0')) {
            p = '251' + p.slice(1);
        } else if (!p.startsWith('251')) {
            p = '251' + p;
        }
        return p;
    }
}
