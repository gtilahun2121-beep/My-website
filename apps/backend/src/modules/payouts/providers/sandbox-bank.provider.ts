/**
 * sandbox-bank.provider.ts
 *
 * Development / test disbursement provider. Used whenever PAYOUT_MODE=sandbox.
 *
 * Always reports success with a deterministic BANK- reference. This is the
 * safe default until QAL signs the required banking/B2C provider agreement
 * and receives production credentials (Tier 3, Phase 3.3/3.4).
 *
 * IMPORTANT: a payout is only marked SUCCESS after this provider confirms the
 * transaction — never when the request is merely submitted.
 */

import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

import {
    DisburseRequest,
    DisburseResponse,
    PayoutProvider,
} from './payout-provider.interface';

@Injectable()
export class SandboxBankProvider implements PayoutProvider {
    readonly name = 'sandbox-bank';

    async disburse(_request: DisburseRequest): Promise<DisburseResponse> {
        return {
            success: true,
            reference: `BANK-${crypto.randomUUID()}`,
        };
    }
}