import { Injectable } from '@nestjs/common';
import { getPool } from '../../config/database.config';

export interface DispatchInput {
    user_id: string;
    category: 'operational' | 'social_trust' | 'system_policy';
    title: string;
    body: string;
    channels?: string;
}

@Injectable()
export class NotificationsRepository {
    async findByUserId(userId: string, limit = 50) {
        const sql = getPool();
        const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
        return sql`
            SELECT * FROM notifications
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
            LIMIT ${safeLimit}
        `;
    }

    async markAsRead(id: string, userId: string) {
        const sql = getPool();
        const rows = await sql`
            UPDATE notifications SET is_read = TRUE 
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING id
        `;
        return rows[0];
    }

    /**
     * Inserts a single notification row for a specific user.
     * Actual delivery (Telegram/SMS/push) happens via the notification
     * worker that polls this table.
     */
    async dispatch(input: DispatchInput): Promise<void> {
        const sql = getPool();
        await sql`
            INSERT INTO notifications (user_id, category, title, body, delivered_channels)
            VALUES (
                ${input.user_id}::uuid,
                ${input.category},
                ${input.title},
                ${input.body},
                ${input.channels ?? 'push'}
            )
        `;
    }

    /**
     * Inserts a notification row for every website admin so the
     * admin console bell surfaces pending requests needing review.
     */
    async dispatchToAdmins(
        category: DispatchInput['category'],
        title: string,
        body: string,
        channels: string = 'push',
    ): Promise<void> {
        const sql = getPool();
        const admins = await sql<{ id: string }[]>`
            SELECT id FROM users WHERE role = 'admin'
        `;
        if (admins.length === 0) return;

        const values = admins.map((a) => ({
            user_id: a.id,
            category,
            title,
            body,
            delivered_channels: channels,
        }));

        await sql`
            INSERT INTO notifications
                ${sql(values, 'user_id', 'category', 'title', 'body', 'delivered_channels')}
        `;
    }
}
