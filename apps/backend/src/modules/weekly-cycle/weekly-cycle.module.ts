/**
 * weekly-cycle.module.ts
 *
 * Wires the Weekly Equb cycle engine: the scheduled cutoff + reminder tasks,
 * the service, the repository, and the HTTP controller.
 */

import { Module } from '@nestjs/common';
import { WeeklyCycleController } from './weekly-cycle.controller';
import { WeeklyCycleService } from './weekly-cycle.service';
import { WeeklyCycleRepository } from './weekly-cycle.repository';
import { WeeklyCycleTask } from './weekly-cycle.task';
import { WeeklyReminderTask } from './weekly-reminder.task';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PaymentsModule, NotificationsModule],
    controllers: [WeeklyCycleController],
    providers: [
        WeeklyCycleService,
        WeeklyCycleRepository,
        WeeklyCycleTask,
        WeeklyReminderTask,
    ],
    exports: [WeeklyCycleService, WeeklyCycleRepository],
})
export class WeeklyCycleModule {}
