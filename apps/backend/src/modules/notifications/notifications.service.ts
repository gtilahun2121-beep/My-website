import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
    constructor(private readonly repo: NotificationsRepository) {}

    async findByUserId(userId: string) {
        return this.repo.findByUserId(userId);
    }

    async markAsRead(id: string, userId: string) {
        return this.repo.markAsRead(id, userId);
    }

    async delete(id: string, userId: string) {
        return this.repo.deleteById(id, userId);
    }

    async cleanupExpiredUnread() {
        return this.repo.deleteExpiredUnreadForNonAdmins();
    }
}
