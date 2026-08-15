/**
 * payout-provider.service.ts
 *
 * Resolves the disbursement provider for a payout.
 *
 *   PAYOUT_MODE=sandbox (default) → SandboxBankProvider for every payout.
 *   PAYOUT_MODE=live              → the registered provider for a channel.
 *
 * New live providers (Bank A, Bank B, Provider C) are registered here.
 */

import { Injectable, Logger } from '@nestjs/common';

import { SandboxBankProvider } from './sandbox-bank.provider';
import { PayoutProvider } from './payout-provider.interface';

export type PayoutMode = 'sandbox' | 'live';

@Injectable()
export class PayoutProviderService {
    private readonly logger = new Logger(PayoutProviderService.name);
    private readonly mode: PayoutMode;

    private readonly sandbox = new SandboxBankProvider();
    private readonly providers = new Map<string, PayoutProvider>();

    constructor() {
        const configured = (process.env.PAYOUT_MODE ?? 'sandbox').toLowerCase();
        this.mode = configured === 'live' ? 'live' : 'sandbox';

        // Register future live providers here, e.g.:
        //   this.providers.set('cbe', new CbeBirrB2CProvider());
        //   this.providers.set('telebirr-b2c', new TelebirrB2CProvider());

        this.logger.log(`PayoutProviderService mode: ${this.mode}`);
    }

    get currentMode(): PayoutMode {
        return this.mode;
    }

    /**
     * Returns the provider to disburse a payout. In sandbox mode every payout
     * goes through the mock bank. In live mode a named provider is required;
     * unknown channels fall back to the sandbox to avoid dead money.
     */
    resolve(channel?: string): PayoutProvider {
        if (this.mode === 'sandbox' || !channel) {
            return this.sandbox;
        }
        return this.providers.get(channel) ?? this.sandbox;
    }
}