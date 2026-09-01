import { Injectable } from '@nestjs/common';
import { getPool, inTransaction, withRlsContext, RlsContext } from '../../config/database.config';

@Injectable()
export class WalletRepository {
    async findByUserId(userId: string) {
        const sql = getPool();
        const rows = await sql`SELECT id, user_id, balance, currency FROM wallets WHERE user_id = ${userId}`;
        return rows[0];
    }

    /**
     * Returns the account holder's Argon2id PIN hash.
     * Runs under RLS context so the user can only read their own row.
     */
    async getUserAuth(userId: string, ctx: RlsContext) {
        return withRlsContext(ctx, async (sql) => {
            const rows = await sql<{ id: string; password_hash: string }[]>`
                SELECT id, password_hash
                FROM users
                WHERE id = ${userId}
                LIMIT 1
            `;
            return rows[0] ?? null;
        });
    }

    /**
     * Credits the wallet and records a deposit ledger entry atomically.
     * Returns the updated wallet row.
     */
    async deposit(userId: string, amount: number, reference: string, ctx: RlsContext) {
        return inTransaction(ctx, async (tx) => {
            const [wallet] = await tx`
                UPDATE wallets
                SET balance = balance + ${amount}, updated_at = NOW()
                WHERE user_id = ${userId}
                RETURNING id, user_id, balance, currency
            `;

            await tx`
                INSERT INTO wallet_transactions (user_id, direction, amount, reference)
                VALUES (${userId}, 'deposit', ${amount}, ${reference})
            `;

            return wallet;
        });
    }

    /**
     * Deducts from the wallet under a row lock (SELECT ... FOR UPDATE) and
     * records a withdrawal ledger entry atomically.
     * Returns null when the wallet does not exist or the balance is insufficient.
     */
    async withdraw(userId: string, amount: number, reference: string, ctx: RlsContext) {
        return inTransaction(ctx, async (tx) => {
            const [wallet] = await tx`
                SELECT id, user_id, balance, currency
                FROM wallets
                WHERE user_id = ${userId}
                FOR UPDATE
            `;

            if (!wallet || wallet.balance < amount) return null;

            const [updated] = await tx`
                UPDATE wallets
                SET balance = balance - ${amount}, updated_at = NOW()
                WHERE user_id = ${userId}
                RETURNING id, user_id, balance, currency
            `;

            await tx`
                INSERT INTO wallet_transactions (user_id, direction, amount, reference)
                VALUES (${userId}, 'withdrawal', ${amount}, ${reference})
            `;

            return updated;
        });
    }

    /**
     * Returns the user's full transaction history — outbound payments,
     * inbound payouts, and wallet deposits/withdrawals — merged, newest first.
     *
     * Implemented as a single UNION ALL so the database does the merge and
     * ordering (one round trip instead of three), bounded by LIMIT.
     */
    async getTransactions(userId: string, limit = 200) {
        const sql = getPool();
        const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
        return sql`
            SELECT *
            FROM (
                SELECT
                    p.id,
                    'payment' AS direction,
                    p.amount,
                    p.payment_status::text AS status,
                    p.paid_at,
                    p.created_at,
                    e.name AS equb_name,
                    p.round_number
                FROM payments p
                JOIN equb_groups e ON e.id = p.equb_id
                WHERE p.user_id = ${userId}

                UNION ALL

                SELECT
                    p.id,
                    'payout' AS direction,
                    p.total_pot_amount AS amount,
                    p.status::text AS status,
                    NULL::timestamptz AS paid_at,
                    p.created_at,
                    e.name AS equb_name,
                    p.round_number
                FROM payouts p
                JOIN equb_groups e ON e.id = p.equb_id
                WHERE p.winner_id = ${userId}

                UNION ALL

                SELECT
                    t.id,
                    t.direction,
                    t.amount,
                    'paid' AS status,
                    t.created_at AS paid_at,
                    t.created_at,
                    COALESCE(t.reference, t.direction) AS equb_name,
                    0 AS round_number
                FROM wallet_transactions t
                WHERE t.user_id = ${userId}
            ) merged
            ORDER BY created_at DESC
            LIMIT ${safeLimit}
        `;
    }
}
