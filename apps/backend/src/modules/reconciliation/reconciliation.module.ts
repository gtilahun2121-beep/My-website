/**
 * reconciliation.module.ts
 *
 * Wires together the nightly reconciliation pipeline:
 *  - ReconciliationService  (analysis + issue detection)
 *  - ReconciliationRepository
 *  - ReconciliationTask    (scheduled cron)
 */

import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationRepository } from './reconciliation.repository';
import { ReconciliationTask } from './tasks/reconciliation.task';

@Module({
    providers: [ReconciliationService, ReconciliationRepository, ReconciliationTask],
    exports: [ReconciliationService],
})
export class ReconciliationModule { }