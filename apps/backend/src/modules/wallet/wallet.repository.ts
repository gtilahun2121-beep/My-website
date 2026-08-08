import { Injectable } from '@nestjs/common';
import { getPool } from '../../config/database.config';

@Injectable()
export class WalletRepository {
    async findByUserId(userId: string) {
        const sql = getPool();
        const rows = await sql`SELECT id, user_id, balance, currency FROM wallets WHERE user_id = ${userId}`;
        return rows[0];
    }

    async addBalance(userId: string, amount: number) {
        const sql = getPool();
        const rows = await sql`
            UPDATE wallets 
            SET balance = balance + ${amount}, updated_at = NOW() 
            WHERE user_id = ${userId} 
            RETURNING balance
        `;
        return rows[0];
    }
}
