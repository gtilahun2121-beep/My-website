/**
 * notifications-cleanup.task.ts
 *
 * Scheduled cron — runs every day at 03:00 UTC (06:00 EAT).
 *
 * Retention policy:
 *  - Regular users: an unread notification is permanently deleted once it is
 *    older than 7 days, even if the user never opens it. Read notifications
 *    are deleted by the user themselves (after doing the requested action).
 *  - Admins: notifications are NOT auto-expired. They are kept until the
 *    admin has seen the notification and completed the task, at which point
 *    the admin deletes it manually (permanent delete).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationsCleanupTask {
    private readonly logger = new Logger(NotificationsCleanupTask.name);

    constructor(private readonly notificationsService: NotificationsService) {}

    @Cron('0 3 * * *', { name: 'notifications-cleanup-task', timeZone: 'UTC' })
    async runCleanup(): Promise<void> {
        const result = await this.notificationsService.cleanupExpiredUnread();
        const count = Array.isArray(result) ? result.length : 0;
        this.logger.log(`Deleted ${count} expired unread notification(s) for non-admin users.`);
    }
}
