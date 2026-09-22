import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsCleanupTask } from './tasks/notifications-cleanup.task';
import { EmailService } from './services/email.service';

@Module({
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationsRepository,
        NotificationsCleanupTask,
        EmailService,
    ],
    exports: [NotificationsService, NotificationsRepository, EmailService],
})
export class NotificationsModule {}
