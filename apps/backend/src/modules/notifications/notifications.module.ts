import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsCleanupTask } from './tasks/notifications-cleanup.task';

@Module({
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationsRepository,
        NotificationsCleanupTask,
    ],
    exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
