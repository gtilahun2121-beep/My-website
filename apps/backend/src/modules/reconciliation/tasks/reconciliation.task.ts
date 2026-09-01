/**
 * reconciliation.task.ts
 *
 * Scheduled cron — nightly end-of-day reconciliation (Tier 3, Phase 3.5).
 *
 * Default: every day at 01:00 UTC (04:00 EAT).
 * Override with RECONCILIATION_CRON (cron expression) in .env.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ReconciliationService } from '../reconciliation.service';

@Injectable()
export class ReconciliationTask {
    private readonly logger = new Logger(ReconciliationTask.name);

    constructor(private readonly reconciliationService: ReconciliationService) { }

    @Cron(process.env.RECONCILIATION_CRON ?? '0 1 * * *', {
        name: 'reconciliation-task',
        timeZone: 'UTC',
    })
    async runNightlyReconciliation(): Promise<void> {
        this.logger.log('Reconciliation task started.');

        try {
            // Sandbox mode synthesises the ledger from confirmed QAL records;
            // live mode will fetch the real gateway/bank ledger here.
            const result =
                await this.reconciliationService.runReconciliation(new Date());
            this.logger.log(
                `Reconciliation completed: run=${result.run_id} ` +
                `missing=${result.missing} duplicate=${result.duplicate} ` +
                `failed=${result.failed} unmatched=${result.unmatched} ` +
                `amount_mismatch=${result.amount_mismatch}`,
            );
        } catch (err: unknown) {
            this.logger.error(
                `Reconciliation task error: ${(err as Error).message}`,
            );
        }
    }
}