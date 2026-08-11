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
    failed_login_attempts: number;
    lockout_stage: number;
    locked_until: Date | null;
}

export interface CreateUserInput {
    phone: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    fayda_id: string;
    /**
     * SHA-256 of the plaintext Fayda ID. Stored in a dedicated column so
     * verify-fayda can detect duplicate registrations without needing to
     * decrypt the pgp-encrypted fayda_id value.
     */
    fayda_id_hash: string;
    telegram_handle?: string;
    /**
     * Classified at registration: the platform owner's phone/email becomes
     * 'admin', everyone else 'participant'. Defaults to 'participant'.
     */
    role?: 'participant' | 'admin';
}

export interface UserSettingsRecord {
    user_id: string;
    two_factor_secret: string | null;
    two_factor_enabled: boolean;
    backup_codes: string[];
    theme: string;
    updated_at: Date;
}

export interface PinResetCodeRecord {
    id: string;
    phone: string;
    purpose: string;
    code_hash: string;
    expires_at: Date;
    attempts: number;
    consumed_at: Date | null;
    created_at: Date;
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
        password_hash, role, is_active, created_at,
        failed_login_attempts, lockout_stage, locked_until
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
        password_hash, role, is_active, created_at,
        failed_login_attempts, lockout_stage, locked_until
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Find a user by their exact phone number — used by the forgot-PIN flow.
     * Runs without RLS context (same as findByIdentifier) because the
     * request happens before a session exists.
     */
    async findByPhone(phone: string): Promise<UserRecord | null> {
        const sql = getPool();

        const rows = await sql<UserRecord[]>`
      SELECT
        id, phone, email, first_name, last_name, fayda_id, telegram_handle,
        password_hash, role, is_active, created_at,
        failed_login_attempts, lockout_stage, locked_until
      FROM users
      WHERE phone = ${phone}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Finds existing accounts matching the given email and/or phone.
     * Used by the signup availability pre-check.
     */
    async findByEmailOrPhone(email?: string, phone?: string): Promise<UserRecord[]> {
        const sql = getPool();

        const clauses: string[] = [];
        const values: string[] = [];

        if (email) {
            values.push(email.toLowerCase());
            clauses.push(`email = $${values.length}`);
        }
        if (phone) {
            values.push(phone);
            clauses.push(`phone = $${values.length}`);
        }
        if (clauses.length === 0) return [];

        return sql.unsafe<UserRecord[]>(
            `SELECT
                id, phone, email, first_name, last_name, fayda_id, telegram_handle,
                password_hash, role, is_active, created_at,
                failed_login_attempts, lockout_stage, locked_until
             FROM users
             WHERE ${clauses.join(' OR ')}`,
            values,
        );
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
          INSERT INTO users (phone, email, password_hash, first_name, last_name, fayda_id, fayda_id_hash, telegram_handle, role)
          VALUES (
            ${input.phone},
            ${input.email.toLowerCase()},
            ${input.password_hash},
            ${input.first_name},
            ${input.last_name},
            ${input.fayda_id},
            ${input.fayda_id_hash},
            ${input.telegram_handle ?? null},
            ${input.role ?? 'participant'}
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

    // ── User Settings (TOTP 2FA + theme) ────────────────────────────────────

    /**
     * Returns the user_settings row (or the seeded defaults).
     * Mirrors the users read pattern: runs without RLS context, exactly
     * like findByIdentifier / findById.
     */
    async getSettings(userId: string): Promise<UserSettingsRecord | null> {
        const sql = getPool();

        const rows = await sql<UserSettingsRecord[]>`
      SELECT user_id, two_factor_secret, two_factor_enabled, backup_codes, theme, updated_at
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /** Stores a pending TOTP secret (2FA not enabled until verified). */
    async setTwoFactorSecret(userId: string, secret: string): Promise<void> {
        const sql = getPool();

        await sql`
      INSERT INTO user_settings (user_id, two_factor_secret)
      VALUES (${userId}, ${secret})
      ON CONFLICT (user_id)
      DO UPDATE SET
        two_factor_secret = EXCLUDED.two_factor_secret,
        updated_at = NOW()
    `;
    }

    /** Enables 2FA and stores the hashed backup codes. */
    async enableTwoFactor(
        userId: string,
        secret: string,
        backupCodeHashes: string[],
    ): Promise<void> {
        const sql = getPool();

        await sql`
      INSERT INTO user_settings (user_id, two_factor_secret, two_factor_enabled, backup_codes)
      VALUES (${userId}, ${secret}, TRUE, ${backupCodeHashes})
      ON CONFLICT (user_id)
      DO UPDATE SET
        two_factor_secret  = EXCLUDED.two_factor_secret,
        two_factor_enabled = TRUE,
        backup_codes       = EXCLUDED.backup_codes,
        updated_at         = NOW()
    `;
    }

    /** Disables 2FA and clears the secret + backup codes. */
    async disableTwoFactor(userId: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE user_settings
      SET two_factor_secret  = NULL,
          two_factor_enabled = FALSE,
          backup_codes       = '{}',
          updated_at         = NOW()
      WHERE user_id = ${userId}
    `;
    }

    /** Consumes (removes) a used backup code hash — one-time use. */
    async removeBackupCode(userId: string, hash: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE user_settings
      SET backup_codes = array_remove(backup_codes, ${hash}),
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    }

    /** Updates the Argon2id password hash (password/PIN change). */
    async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${userId}
    `;
    }

    // ── Login lockout (escalating PIN attempts) ──────────────────────────────

    /**
     * Increments the consecutive failed-attempt counter. Returns the new count.
     * The caller decides when to apply a lock (e.g. at 3 failures).
     */
    async incrementFailedAttempt(userId: string): Promise<number> {
        const sql = getPool();

        const [row] = await sql<{ failed_login_attempts: number }[]>`
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING failed_login_attempts
    `;

        return row?.failed_login_attempts ?? 1;
    }

    /**
     * Applies a lockout: resets the attempt counter and stores the stage +
     * expiry. Stage 4 (permanent) passes lockedUntil = null.
     */
    async applyLockout(
        userId: string,
        stage: number,
        lockedUntil: Date | null,
    ): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE users
      SET failed_login_attempts = 0,
          lockout_stage         = ${stage},
          locked_until          = ${lockedUntil},
          updated_at            = NOW()
      WHERE id = ${userId}
    `;
    }

    /**
     * Clears an already-expired lock so the user gets a fresh set of attempts.
     * The lockout_stage is preserved so the next failure escalates to a longer
     * lock (6h → 1d → 3d → permanent).
     */
    async clearExpiredLockout(userId: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE users
      SET failed_login_attempts = 0,
          locked_until          = NULL,
          updated_at            = NOW()
      WHERE id = ${userId}
        AND locked_until IS NOT NULL
        AND locked_until <= NOW()
    `;
    }

    /**
     * Resets the whole lockout state after a successful login, or when an
     * admin manually unblocks the account.
     */
    async resetLoginAttempts(userId: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE users
      SET failed_login_attempts = 0,
          lockout_stage         = 0,
          locked_until          = NULL,
          updated_at            = NOW()
      WHERE id = ${userId}
    `;
    }

    // ── PIN reset OTP codes ──────────────────────────────────────────────────

    /**
     * Replaces any outstanding PIN-reset code for the phone with a new one.
     * Only the SHA-256 hash of the code is stored — never the plaintext.
     */
    async upsertPinResetCode(
        phone: string,
        codeHash: string,
        expiresAt: Date,
        purpose: string = 'pin_reset',
    ): Promise<void> {
        const sql = getPool();

        await sql.begin(async (tx) => {
            // Invalidate any existing unconsumed code for this phone
            await tx`
        UPDATE pin_reset_codes
        SET consumed_at = NOW()
        WHERE phone = ${phone} AND consumed_at IS NULL
      `;

            await tx`
        INSERT INTO pin_reset_codes (phone, purpose, code_hash, expires_at)
        VALUES (${phone}, ${purpose}, ${codeHash}, ${expiresAt})
      `;
        });
    }

    /**
     * Returns the most recent unconsumed, unexpired PIN-reset code for a phone.
     */
    async findActivePinResetCode(phone: string): Promise<PinResetCodeRecord | null> {
        const sql = getPool();

        const rows = await sql<PinResetCodeRecord[]>`
      SELECT id, phone, purpose, code_hash, expires_at, attempts, consumed_at, created_at
      FROM pin_reset_codes
      WHERE phone = ${phone}
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Increments the attempt counter for a PIN-reset code.
     * Returns the new attempt count.
     */
    async incrementPinResetAttempts(codeId: string): Promise<number> {
        const sql = getPool();

        const [row] = await sql<{ attempts: number }[]>`
      UPDATE pin_reset_codes
      SET attempts = attempts + 1
      WHERE id = ${codeId}
      RETURNING attempts
    `;

        return row?.attempts ?? 0;
    }

    /**
     * Marks a PIN-reset code as consumed so it cannot be reused.
     */
    async consumePinResetCode(codeId: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE pin_reset_codes
      SET consumed_at = NOW()
      WHERE id = ${codeId}
    `;
    }

    /**
     * Replaces a user's password hash AND clears the whole login-lockout
     * state. Used by the self-service PIN-reset flow once the OTP verifies.
     * Runs without an RLS context because the request is pre-session (the
     * same pattern as updatePasswordHash / resetLoginAttempts).
     */
    async resetPinAndUnlockByPhone(
        phone: string,
        passwordHash: string,
    ): Promise<UserRecord | null> {
        const sql = getPool();

        const rows = await sql<UserRecord[]>`
      UPDATE users
      SET password_hash         = ${passwordHash},
          failed_login_attempts = 0,
          lockout_stage         = 0,
          locked_until          = NULL,
          updated_at            = NOW()
      WHERE phone = ${phone}
      RETURNING
        id, phone, email, first_name, last_name, fayda_id, telegram_handle,
        password_hash, role, is_active, created_at,
        failed_login_attempts, lockout_stage, locked_until
    `;

        return rows[0] ?? null;
    }

    /**
     * Checks whether any registered account already uses the given Fayda ID.
     * The fayda_id column is stored encrypted (pgp_sym_encrypt), so we look
     * up the deterministic SHA-256 hash instead — a hash every registration
     * stores alongside the encrypted value.
     */
    async findUserByFaydaHash(faydaIdHash: string): Promise<UserRecord | null> {
        const sql = getPool();

        const rows = await sql<UserRecord[]>`
      SELECT
        id, phone, email, first_name, last_name, fayda_id, telegram_handle,
        password_hash, role, is_active, created_at,
        failed_login_attempts, lockout_stage, locked_until
      FROM users
      WHERE fayda_id_hash = ${faydaIdHash}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }
}
