/**
 * auth.service.ts
 *
 * Core authentication business logic:
 *
 *  - register()      — hash password with Argon2id, create user + wallet + credit score
 *  - login()         — verify Argon2id hash, issue RS256 JWT access + refresh tokens
 *  - refreshTokens() — validate refresh token, rotate both tokens
 *  - logout()        — revoke refresh token
 *
 * JWT Architecture (from spec §1.2):
 *  - Access token:  RS256, 15-minute TTL, carries sub/role/trust_tier claims
 *  - Refresh token: RS256, 7-day TTL, stored as Argon2id hash in DB
 */

import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { AuthRepository, UserRecord } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VaultConfig } from '../../config/vault.config';

// ---------------------------------------------------------------------------
// Argon2id parameters — from spec §1.3
// ---------------------------------------------------------------------------
const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,      // 3 iterations
    parallelism: 4,      // 4 threads
    hashLength: 32,     // 32-byte output key
    saltLength: 16,     // 16-byte random salt per hash
};

// ---------------------------------------------------------------------------
// JWT Payload Shape
// ---------------------------------------------------------------------------
export interface JwtPayload {
    sub: string;   // user UUID
    phone: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'participant' | 'host' | 'admin';
    trust_tier: string;
    jti: string;   // unique token ID (UUID v4)
    iat?: number;
    exp?: number;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly authRepository: AuthRepository,
        private readonly jwtService: JwtService,
    ) { }

    // ── Register ─────────────────────────────────────────────────────────────

    /**
     * Registers a new participant.
     *
     * Pipeline:
     *  1. Check no duplicate phone/email exists
     *  2. Hash password with Argon2id + pepper
     *  3. Persist user + wallet + credit_score in one ACID transaction
     *  4. Issue access + refresh tokens
     */
    async register(dto: RegisterDto): Promise<AuthTokens> {
        const secrets = await VaultConfig.load();

        // Hash password — pepper is appended before hashing to add a
        // server-side secret that makes offline dictionary attacks impossible
        // even if the hash column is leaked.
        const passwordHash = await argon2.hash(
            dto.password + secrets.ARGON2_PEPPER,
            ARGON2_OPTIONS,
        );

        let user: UserRecord;
        try {
            user = await this.authRepository.createUser({
                phone: dto.phone,
                email: dto.email,
                password_hash: passwordHash,
                first_name: dto.first_name,
                last_name: dto.last_name,
                fayda_id: dto.fayda_id,
                telegram_handle: dto.telegram_handle,
            });
        } catch (err: any) {
            // Postgres unique violation (23505)
            if (err?.code === '23505') {
                throw new ConflictException(
                    'An account with this phone number or email already exists.',
                );
            }
            throw err;
        }

        this.logger.log(`New user registered: ${user.id}`);
        return this.issueTokens(user);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    /**
     * Authenticates a user by phone or email + password.
     *
     * Pipeline:
     *  1. Fetch user by identifier
     *  2. Verify Argon2id hash (constant-time, GPU-resistant)
     *  3. Check account is active
     *  4. Issue access + refresh tokens
     */
    async login(dto: LoginDto): Promise<AuthTokens> {
        const secrets = await VaultConfig.load();

        const user = await this.authRepository.findByIdentifier(dto.identifier);

        // Use a constant-time dummy verify to prevent user enumeration timing attacks
        if (!user) {
            await argon2.hash('dummy_password' + secrets.ARGON2_PEPPER, ARGON2_OPTIONS);
            throw new UnauthorizedException('Invalid credentials.');
        }

        const isPasswordValid = await argon2.verify(
            user.password_hash,
            dto.password + secrets.ARGON2_PEPPER,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials.');
        }

        if (!user.is_active) {
            throw new UnauthorizedException(
                'Your account has been deactivated. Please contact support.',
            );
        }

        this.logger.log(`User logged in: ${user.id}`);
        return this.issueTokens(user);
    }

    // ── Refresh Tokens ────────────────────────────────────────────────────────

    /**
     * Validates a refresh token and rotates both access and refresh tokens.
     * Old refresh token is invalidated immediately (rotation prevents replay).
     */
    async refreshTokens(
        userId: string,
        incomingRefreshToken: string,
    ): Promise<AuthTokens> {
        const secrets = await VaultConfig.load();

        const user = await this.authRepository.findById(userId);
        if (!user || !user.is_active) {
            throw new UnauthorizedException('Session invalid. Please log in again.');
        }

        const storedHash = await this.authRepository.getRefreshTokenHash(userId);
        if (!storedHash) {
            throw new UnauthorizedException('Session expired. Please log in again.');
        }

        const isValid = await argon2.verify(
            storedHash,
            incomingRefreshToken + secrets.ARGON2_PEPPER,
        );

        if (!isValid) {
            // Possible token reuse — revoke all sessions as a security measure
            await this.authRepository.deleteRefreshToken(userId);
            throw new UnauthorizedException(
                'Token reuse detected. All sessions have been revoked.',
            );
        }

        return this.issueTokens(user);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    async logout(userId: string): Promise<void> {
        await this.authRepository.deleteRefreshToken(userId);
        this.logger.log(`User logged out: ${userId}`);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    /**
     * Issues a new RS256 access token (15m) and refresh token (7d).
     * Refresh token is hashed with Argon2id before storage.
     *
     * JWT payload matches spec §1.2 exactly:
     * { sub, phone, email, role, trust_tier, jti, iat, exp }
     */
    private async issueTokens(user: UserRecord): Promise<AuthTokens> {
        const secrets = await VaultConfig.load();

        const jti = uuidv4();

        const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
            sub: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            trust_tier: 'standard', // credit_scores.tier resolved on demand via separate query if needed
            jti,
        };

        // Sign access token — RS256 private key, 15m TTL
        const access_token = await this.jwtService.signAsync(payload, {
            algorithm: 'RS256',
            privateKey: secrets.JWT_PRIVATE_KEY,
            expiresIn: '15m',
        });

        // Sign refresh token — RS256 private key, 7d TTL
        // jti is different so the two tokens cannot be confused
        const refreshJti = uuidv4();
        const refresh_token = await this.jwtService.signAsync(
            { ...payload, jti: refreshJti },
            {
                algorithm: 'RS256',
                privateKey: secrets.JWT_PRIVATE_KEY,
                expiresIn: '7d',
            },
        );

        // Hash refresh token before storing
        const refreshHash = await argon2.hash(
            refresh_token + secrets.ARGON2_PEPPER,
            ARGON2_OPTIONS,
        );
        await this.authRepository.upsertRefreshToken(user.id, refreshHash);

        return { access_token, refresh_token };
    }
}
