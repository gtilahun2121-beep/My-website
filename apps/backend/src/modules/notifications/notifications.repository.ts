import { Injectable } from '@nestjs/common';
import { getPool } from '../../config/database.config';

@Injectable()
export class NotificationsRepository {
    async findByUserId(userId: string) {
        const sql = getPool();
        return sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC`;
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
}
