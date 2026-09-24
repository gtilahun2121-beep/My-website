/**
 * payment-provider.service.ts
 *
 * Resolves a concrete PaymentProvider for a requested gateway name.
 *
 *   PAYMENT_MODE=sandbox (default) → SandboxPaymentProvider for EVERY gateway.
 *   PAYMENT_MODE=live              → the real gateway provider (Chapa/Telebirr).
 *
 * This is the seam that lets QAL move from mock payments to live money
 * movement with a single environment variable flip.
 */

import { Injectable, Logger } from '@nestjs/common';

import { ChapaPaymentProvider } from './chapa.provider';
import { SandboxPaymentProvider } from './sandbox.provider';
import { TelebirrPaymentProvider } from './telebirr.provider';
import { DashenBankProvider } from './dashen-bank.provider';
import {
    PaymentProvider,
    PaymentProviderName,
} from './payment-provider.interface';

export type PaymentMode = 'sandbox' | 'live';

@Injectable()
export class PaymentProviderService {
    private readonly logger = new Logger(PaymentProviderService.name);
    private readonly mode: PaymentMode;

    private readonly sandbox = new SandboxPaymentProvider();
    private readonly providers = new Map<PaymentProviderName, PaymentProvider>([
        ['chapa', new ChapaPaymentProvider()],
        ['telebirr', new TelebirrPaymentProvider()],
        ['dashen_bank', new DashenBankProvider()],
    ]);

    constructor() {
        const configured = (process.env.PAYMENT_MODE ?? 'sandbox').toLowerCase();
        this.mode = configured === 'live' ? 'live' : 'sandbox';
        this.logger.log(`PaymentProviderService mode: ${this.mode}`);
    }

    get currentMode(): PaymentMode {
        return this.mode;
    }

    /**
     * Returns the provider used to collect contributions for a gateway.
     * In sandbox mode every gateway resolves to the mock provider.
     */
    resolve(name: PaymentProviderName): PaymentProvider {
        if (this.mode === 'sandbox') {
            return this.sandbox;
        }
        const provider = this.providers.get(name);
        if (!provider) {
            throw new Error(`Unsupported payment provider: ${name}`);
        }
        return provider;
    }
}