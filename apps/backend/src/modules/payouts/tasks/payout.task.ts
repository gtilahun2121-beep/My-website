/**
 * payout.task.ts
 *
 * Scheduled cron — disburses all ready payouts (Tier 3, Phase 3.4).
 *
 * Default: every day at 07:00 UTC (10:00 EAT).
 * Override with PAYOUT_CRON (cron expression) in .env.
 *
 * Pipeline:
 *   Find ready payouts (pending/queued/retry)
 *        ↓
 *   Group into a payout batch run
 *        ↓
 *   Per payout: provider.disburse
 *        ↓
 *   Provider confirmation → payout = success
 *        ↓
 *   Batch run completed
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PayoutsService, SYSTEM_CONTEXT } from '../payouts.service';

@Injectable()
export class PayoutTask {
    private readonly logger = new Logger(PayoutTask.name);

    constructor(private readonly payoutsService: PayoutsService) { }

    @Cron(process.env.PAYOUT_CRON ?? '0 7 * * *', {
        name: 'payout-task',
        timeZone: 'UTC',
    })
    async runPayouts(): Promise<void> {
        this.logger.log('Payout task started.');

        try {
            const result = await this.payoutsService.processPendingPayouts(
                SYSTEM_CONTEXT,
            );
            this.logger.log(
                `Payout task completed: ${result.processed} processed, ` +
                `${result.succeeded} succeeded, ${result.failed} failed.`,
            );
        } catch (err: unknown) {
            this.logger.error(
                `Payout task error: ${(err as Error).message}`,
            );
        }
    }
}