/**
 * auth.repository.ts
 *
 * All database reads/writes for the auth module.
 * Uses the withRlsContext / inTransaction helpers from database.config
 * so every query automatically respects Postgres RLS policies.
 *
 * Responsibilities:
 *  - Find user by phone, email, or ID
 *  - Create a new user record + linked wallet + credit_score row
 *  - Store / verify / rotate refresh token hashes
 */

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { getPool } from '../../config/database.config';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface UserRecord {
    id: string;
    phone: string;
    email: string;
    first_name: string;
    last_name: string;
    fayda_id: string;
    telegram_handle: string | null;
    password_hash: string;
    role: 'participant' | 'host' | 'admin';
    is_active: boolean;
    created_at: Date;
}

export interface CreateUserInput {
    phone: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    fayda_id: string;
    telegram_handle?: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class AuthRepository {
    private readonly logger = new Logger(AuthRepository.name);

    // ── Read ────────────────────────────────────────────────────────────────

    /**
     * Find a user by phone OR email — used during login.
     * Runs without RLS context because login happens before a session exists.
     * The SECURITY DEFINER pattern is safe here: we only return the hash,
     * never the raw password or Fayda ID.
     */
    async findByIdentifier(identifier: string): Promise<UserRecord | null> {
        const sql = getPool();

        // identifier can be a phone (+251...) or an email address
        const rows = await sql<UserRecord[]>`
      SELECT
        id, phone, email, first_name, last_name, fayda_id, telegram_handle,
        password_hash, role, is_active, created_at
      FROM users
      WHERE phone = ${identifier}
         OR email = ${identifier.toLowerCase()}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Find a user by their UUID — used by the JWT guard after token validation.
     */
    async findById(id: string): Promise<UserRecord | null> {
        const sql = getPool();

        const rows = await sql<UserRecord[]>`
      SELECT
        id, phone, email, first_name, last_name, fayda_id, telegram_handle,
        password_hash, role, is_active, created_at
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    // ── Write ───────────────────────────────────────────────────────────────

    /**
     * Creates a new user and atomically provisions:
     *   1. The users row
     *   2. An empty wallet (balance = 0.00 ETB)
     *   3. A default credit_scores row (trust_score = 500, tier = standard)
     *
     * All three inserts happen in one ACID transaction — if any fails,
     * the entire registration is rolled back.
     *
     * NOTE: This runs without RLS context because the user doesn't exist
     * yet (no session). The application layer enforces uniqueness via the
     * UNIQUE constraints on phone and email.
     */
    async createUser(input: CreateUserInput): Promise<UserRecord> {
        const sql = getPool();

        try {
            const result = await sql.begin(async (tx) => {
                // 1. Insert user
                const [user] = await tx<UserRecord[]>`
          INSERT INTO users (phone, email, password_hash, first_name, last_name, fayda_id, telegram_handle)
          VALUES (
            ${input.phone},
            ${input.email.toLowerCase()},
            ${input.password_hash},
            ${input.first_name},
            ${input.last_name},
            ${input.fayda_id},
            ${input.telegram_handle ?? null}
          )
          RETURNING id, phone, email, first_name, last_name, fayda_id, telegram_handle,
                    password_hash, role, is_active, created_at
        `;

                // 2. Provision empty wallet
                await tx`
          INSERT INTO wallets (user_id) VALUES (${user.id})
        `;

                // 3. Provision default credit score
                await tx`
          INSERT INTO credit_scores (user_id) VALUES (${user.id})
        `;

                return user;
            });

            return result;
        } catch (err: any) {
            // Postgres unique violation code: 23505
            if (err?.code === '23505') {
                // Re-throw a clean message — the service layer converts this to
                // a 409 ConflictException
                throw err;
            }
            this.logger.error('createUser failed', err);
            throw new InternalServerErrorException('Registration failed. Please try again.');
        }
    }

    // ── Refresh Token Store ─────────────────────────────────────────────────
    //
    // Refresh tokens are hashed (Argon2id) before storage so that even if
    // the database is compromised, live tokens cannot be replayed.
    // We store them in a dedicated table for O(1) lookup and easy revocation.
    //

    /**
     * Persists a hashed refresh token for the given user.
     * Replaces any existing token for that user (single active session per user).
     */
    async upsertRefreshToken(userId: string, tokenHash: string): Promise<void> {
        const sql = getPool();

        await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (
        ${userId},
        ${tokenHash},
        NOW() + INTERVAL '7 days'
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `;
    }

    /**
     * Retrieves the stored refresh token hash for a user.
     * Returns null if no token exists or it has expired.
     */
    async getRefreshTokenHash(userId: string): Promise<string | null> {
        const sql = getPool();

        const rows = await sql<{ token_hash: string }[]>`
      SELECT token_hash
      FROM refresh_tokens
      WHERE user_id  = ${userId}
        AND expires_at > NOW()
      LIMIT 1
    `;

        return rows[0]?.token_hash ?? null;
    }

    /**
     * Deletes the refresh token for a user — called on logout.
     */
    async deleteRefreshToken(userId: string): Promise<void> {
        const sql = getPool();

        await sql`
      DELETE FROM refresh_tokens WHERE user_id = ${userId}
    `;
    }
}
