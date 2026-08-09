import { Injectable } from '@nestjs/common';
import { getPool } from '../../config/database.config';

@Injectable()
export class UsersRepository {
    async findById(id: string) {
        const sql = getPool();
        const rows = await sql`
            SELECT id, first_name, last_name, phone, email, telegram_handle, profile_photo, role, is_active, created_at
            FROM users WHERE id = ${id}
        `;
        return rows[0];
    }

    async update(id: string, data: any) {
        const sql = getPool();
        const allowed = ['first_name', 'last_name', 'phone', 'email', 'telegram_handle', 'profile_photo'];
        const sets: string[] = [];
        const values: any[] = [];

        for (const key of allowed) {
            if (data[key] !== undefined) {
                values.push(data[key]);
                sets.push(`${key} = $${values.length}`);
            }
        }

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const rows = await sql.unsafe(`
            UPDATE users
            SET ${sets.join(', ')}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING id, first_name, last_name, phone, email, telegram_handle, profile_photo, role, is_active, created_at
        `, values);
        return rows[0];
    }
}
