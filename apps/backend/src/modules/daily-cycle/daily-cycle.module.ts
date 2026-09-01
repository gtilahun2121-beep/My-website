/**
 * daily-cycle.module.ts
 *
 * Wires the Daily Equb cycle engine: the scheduled cutoff task, the service,
 * the repository, and the HTTP controller.
 */

import { Module } from '@nestjs/common';
import { DailyCycleController } from './daily-cycle.controller';
import { DailyCycleService } from './daily-cycle.service';
import { DailyCycleRepository } from './daily-cycle.repository';
import { DailyCycleTask } from './daily-cycle.task';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PaymentsModule, NotificationsModule],
    controllers: [DailyCycleController],
    providers: [DailyCycleService, DailyCycleRepository, DailyCycleTask],
    exports: [DailyCycleService, DailyCycleRepository],
})
export class DailyCycleModule {}
