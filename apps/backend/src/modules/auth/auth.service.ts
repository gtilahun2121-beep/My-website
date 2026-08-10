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
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib';

import { AuthRepository, UserRecord, UserSettingsRecord } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto, TwoFactorLoginDto } from './dto/two-factor.dto';
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

// TOTP codes are verified with a ±30s window to allow clock skew between the
// user's authenticator app and the server.

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

/** Returned by login() when the account has 2FA enabled. */
export interface TwoFactorRequired {
    two_factor_required: true;
    mfa_token: string;
}

// ---------------------------------------------------------------------------
// Backup-code helpers (one-time, stored as SHA-256 hashes)
// ---------------------------------------------------------------------------

function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function generateBackupCodes(count: number): string[] {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no visually-confusing chars
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < 8; j++) {
            code += alphabet[randomBytes(1)[0] % alphabet.length];
        }
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
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
    async login(dto: LoginDto): Promise<AuthTokens | TwoFactorRequired> {
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

        // If the account has 2FA enabled, pause the login and require a TOTP
        // (or backup) code before issuing any tokens.
        const settings = await this.authRepository.getSettings(user.id);
        if (settings?.two_factor_enabled) {
            this.logger.log(`2FA required for login: ${user.id}`);
            const mfa_token = await this.signMfaToken(user);
            return { two_factor_required: true, mfa_token };
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

    // ── Password / PIN change ─────────────────────────────────────────────────

    /**
     * Verifies the current PIN and replaces it with a new Argon2id hash.
     * The refresh token is revoked so the user must log in again.
     */
    async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
        const secrets = await VaultConfig.load();

        const user = await this.authRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found.');
        }

        const isCurrentValid = await argon2.verify(
            user.password_hash,
            dto.current_password + secrets.ARGON2_PEPPER,
        );
        if (!isCurrentValid) {
            throw new UnauthorizedException('Current PIN is incorrect.');
        }

        const newHash = await argon2.hash(dto.new_password + secrets.ARGON2_PEPPER, ARGON2_OPTIONS);
        await this.authRepository.updatePasswordHash(userId, newHash);
        await this.authRepository.deleteRefreshToken(userId); // force re-login

        this.logger.log(`Password changed: ${userId}`);
        return { success: true };
    }

    // ── Two-factor authentication (TOTP) ─────────────────────────────────────

    /** Generates a TOTP secret + otpauth URL. Secret is stored pending verification. */
    async setupTwoFactor(userId: string): Promise<{ secret: string; otpauth_url: string }> {
        const user = await this.authRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found.');
        }

        const secret = generateSecret();
        await this.authRepository.setTwoFactorSecret(userId, secret);

        return {
            secret,
            otpauth_url: generateURI({
                issuer: 'QalNet',
                label: user.email || user.phone,
                secret,
            }),
        };
    }

    /** Verifies the setup code and enables 2FA, returning one-time backup codes. */
    async verifyTwoFactorSetup(
        userId: string,
        dto: TwoFactorCodeDto,
    ): Promise<{ enabled: boolean; backup_codes: string[] }> {
        const settings = await this.authRepository.getSettings(userId);
        if (!settings?.two_factor_secret) {
            throw new BadRequestException('No pending 2FA setup. Call /2fa/setup first.');
        }

        if (!(await verifyOtp({ token: dto.code, secret: settings.two_factor_secret, epochTolerance: 30 })).valid) {
            throw new UnauthorizedException('Invalid code. Check the 6-digit code in your authenticator app.');
        }

        const backupCodes = generateBackupCodes(8);
        const hashes = backupCodes.map(sha256Hex);
        await this.authRepository.enableTwoFactor(userId, settings.two_factor_secret, hashes);

        this.logger.log(`2FA enabled: ${userId}`);
        return { enabled: true, backup_codes: backupCodes };
    }

    /** Disables 2FA after confirming the user still holds a valid code. */
    async disableTwoFactor(
        userId: string,
        dto: TwoFactorCodeDto,
    ): Promise<{ enabled: boolean }> {
        const settings = await this.authRepository.getSettings(userId);
        if (!settings?.two_factor_secret) {
            throw new BadRequestException('2FA is not enabled for this account.');
        }

        await this.consumeTwoFactorCode(userId, dto.code, settings);
        await this.authRepository.disableTwoFactor(userId);

        this.logger.log(`2FA disabled: ${userId}`);
        return { enabled: false };
    }

    /** Current 2FA status — used by the settings screen. */
    async getTwoFactorStatus(userId: string): Promise<{ enabled: boolean; backup_codes_count: number }> {
        const settings = await this.authRepository.getSettings(userId);
        return {
            enabled: settings?.two_factor_enabled ?? false,
            backup_codes_count: settings?.backup_codes?.length ?? 0,
        };
    }

    /**
     * Completes the second step of login (after /auth/login returned
     * two_factor_required). Validates the MFA token, then the TOTP or
     * backup code, and finally issues the real access + refresh tokens.
     */
    async verifyTwoFactorLogin(dto: TwoFactorLoginDto): Promise<AuthTokens> {
        const secrets = await VaultConfig.load();

        let payload: (JwtPayload & { type?: string }) | null = null;
        try {
            payload = await this.jwtService.verifyAsync<JwtPayload & { type?: string }>(
                dto.mfa_token,
                { publicKey: secrets.JWT_PUBLIC_KEY, algorithms: ['RS256'] },
            );
        } catch {
            throw new UnauthorizedException('MFA session expired. Please log in again.');
        }

        if (payload.type !== 'mfa') {
            throw new UnauthorizedException('Invalid MFA token.');
        }

        const user = await this.authRepository.findById(payload.sub);
        if (!user || !user.is_active) {
            throw new UnauthorizedException('Account unavailable.');
        }

        const settings = await this.authRepository.getSettings(user.id);
        if (!settings?.two_factor_enabled || !settings.two_factor_secret) {
            throw new UnauthorizedException('2FA is not enabled for this account.');
        }

        await this.consumeTwoFactorCode(user.id, dto.code, settings);

        this.logger.log(`2FA login success: ${user.id}`);
        return this.issueTokens(user);
    }

    /**
     * Validates a TOTP or backup code. Backup codes are consumed on use.
     * Throws UnauthorizedException when neither matches.
     */
    private async consumeTwoFactorCode(
        userId: string,
        code: string,
        settings: UserSettingsRecord,
    ): Promise<void> {
        if ((await verifyOtp({ token: code, secret: settings.two_factor_secret!, epochTolerance: 30 })).valid) {
            return;
        }

        const normalized = code.toUpperCase().trim();
        const hash = sha256Hex(normalized);
        if (settings.backup_codes?.includes(hash)) {
            await this.authRepository.removeBackupCode(userId, hash);
            return;
        }

        throw new UnauthorizedException('Invalid or expired code.');
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

    /**
     * Issues a short-lived (5m) MFA token used only to prove the password
     * step succeeded. It carries a `type: 'mfa'` claim and is redeemed by
     * verifyTwoFactorLogin in exchange for the real token pair.
     */
    private async signMfaToken(user: UserRecord): Promise<string> {
        const secrets = await VaultConfig.load();

        const payload = {
            sub: user.id,
            phone: user.phone,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            trust_tier: 'standard',
            jti: uuidv4(),
            type: 'mfa',
        };

        return this.jwtService.signAsync(payload, {
            algorithm: 'RS256',
            privateKey: secrets.JWT_PRIVATE_KEY,
            expiresIn: '5m',
        });
    }
}
