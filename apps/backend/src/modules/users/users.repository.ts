import { Injectable } from '@nestjs/common';
import { getPool } from '../../config/database.config';

@Injectable()
export class UsersRepository {
    async findById(id: string) {
        const sql = getPool();
        const rows = await sql`
            SELECT id, first_name, last_name, phone, email, telegram_handle, role, is_active, created_at
            FROM users WHERE id = ${id}
        `;
        return rows[0];
    }

    async update(id: string, data: any) {
        // Stub for update logic
        return { success: true, updated: true };
    }
}
