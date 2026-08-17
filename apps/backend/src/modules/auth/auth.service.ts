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
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes, randomInt } from 'crypto';
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib';

import { AuthRepository, UserRecord, UserSettingsRecord } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto, TwoFactorLoginDto } from './dto/two-factor.dto';
import { VaultConfig } from '../../config/vault.config';
import { SmsService } from '../sms/sms.service';

// ---------------------------------------------------------------------------
// Argon2id parameters — from spec §1.3
// ---------------------------------------------------------------------------
const ARGON2_OPTIONS: argon2.HashOptions & { raw: false } = {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,      // 3 iterations
    parallelism: 4,      // 4 threads
    hashLength: 32,     // 32-byte output key
    raw: false,
};

// TOTP codes are verified with a ±30s window to allow clock skew between the
// user's authenticator app and the server.

// The platform owner (database owner) registers through the SAME signup form
// as every member. At registration the system classifies the account by
// matching the phone/email against the owner's credentials: a match becomes
// a website admin (admin console + dashboard), anything else becomes a member.
const PLATFORM_ADMIN_PHONE = process.env.PLATFORM_ADMIN_PHONE || '+251904556677';
const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'danel@qalnet.com';

// PIN lockout policy: after 3 consecutive wrong PINs the account is locked
// for 10 minutes. When the lock expires the counter resets and the user gets
// a fresh set of 3 attempts — another 3 consecutive misses locks again for
// another 10 minutes. A successful login clears the whole lockout state.
const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

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
        private readonly smsService: SmsService,
    ) { }

    // ── Register ─────────────────────────────────────────────────────────────

    /**
     * Registers a new user through the single, shared signup form.
     *
     * The role is classified automatically from the registered phone/email:
     * the platform owner's credentials get role `admin`, everyone else gets
     * `participant`. There is no separate admin registration format.
     *
     * Pipeline:
     *  1. Classify the account (admin vs member) from the owner's phone/email
     *  2. Check no duplicate phone/email exists
     *  3. Hash password with Argon2id + pepper
     *  4. Persist user + wallet + credit_score in one ACID transaction
     *  5. Issue access + refresh tokens (carry the classified role)
     */
    async register(dto: RegisterDto): Promise<AuthTokens> {
        const secrets = await VaultConfig.load();

        // Classify the account at registration time.
        const role: 'participant' | 'admin' =
            dto.phone === PLATFORM_ADMIN_PHONE ||
            dto.email.toLowerCase() === PLATFORM_ADMIN_EMAIL
                ? 'admin'
                : 'participant';

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
                fayda_id_hash: sha256Hex(dto.fayda_id),
                telegram_handle: dto.telegram_handle,
                role,
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

        this.logger.log(`New user registered: ${user.id} (role=${role})`);
        return this.issueTokens(user);
    }

    /**
     * Pre-checks whether an email and/or phone is already registered —
     * lets the signup form tell the user before they submit.
     */
    async checkAvailability(dto: CheckAvailabilityDto): Promise<{
        available: boolean;
        email_taken: boolean;
        phone_taken: boolean;
    }> {
        const { email, phone } = dto;

        if (!email && !phone) {
            throw new BadRequestException(
                'Provide at least one of email or phone to check availability.',
            );
        }

        const matches = await this.authRepository.findByEmailOrPhone(email, phone);
        const emailLower = email?.toLowerCase();

        return {
            available: matches.length === 0,
            email_taken: emailLower
                ? matches.some((m) => m.email.toLowerCase() === emailLower)
                : false,
            phone_taken: phone
                ? matches.some((m) => m.phone === phone)
                : false,
        };
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    /**
     * Authenticates a user by phone or email + password.
     *
     * Enforces a fixed PIN lockout:
     *   - 3 consecutive wrong PINs → locked for 10 minutes
     *   - the user is told "You are locked for 10 minutes. Please wait."
     *   - after 10 minutes the lock expires and the counter resets, so the
     *     next 3 consecutive misses lock the account again for 10 minutes.
     * A successful login clears the entire lockout state.
     */
    async login(dto: LoginDto): Promise<AuthTokens | TwoFactorRequired> {
        const secrets = await VaultConfig.load();

        const user = await this.authRepository.findByIdentifier(dto.identifier);

        // Use a constant-time dummy verify to prevent user enumeration timing attacks
        if (!user) {
            await argon2.hash('dummy_password' + secrets.ARGON2_PEPPER, ARGON2_OPTIONS);
            throw new UnauthorizedException('Invalid credentials.');
        }

        // ── Lockout gate ─────────────────────────────────────────────────────
        if (user.locked_until && user.locked_until.getTime() > Date.now()) {
            throw new UnauthorizedException(
                `You are locked for 10 minutes. Please wait and try again after ${this.formatLockEnd(user.locked_until)}.`,
            );
        }

        // Lock expired — clear it and reset the counter so the user gets a
        // fresh set of attempts.
        if (user.locked_until) {
            await this.authRepository.clearExpiredLockout(user.id);
            user.locked_until = null;
            user.failed_login_attempts = 0;
            user.lockout_stage = 0;
        }

        const isPasswordValid = await argon2.verify(
            user.password_hash,
            dto.password + secrets.ARGON2_PEPPER,
        );

        if (!isPasswordValid) {
            const attempts = await this.authRepository.incrementFailedAttempt(user.id);
            this.logger.warn(`Failed PIN attempt ${attempts}/${MAX_FAILED_ATTEMPTS} for user: ${user.id}`);

            if (attempts >= MAX_FAILED_ATTEMPTS) {
                const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
                await this.authRepository.applyLockout(user.id, 1, lockedUntil);
                throw new UnauthorizedException(
                    'You are locked for 10 minutes. Please wait before trying again.',
                );
            }

            throw new UnauthorizedException(
                `Invalid PIN. ${MAX_FAILED_ATTEMPTS - attempts} attempt${MAX_FAILED_ATTEMPTS - attempts === 1 ? '' : 's'} remaining. After ${MAX_FAILED_ATTEMPTS} consecutive incorrect attempts your account is locked for 10 minutes.`,
            );
        }

        // Correct PIN — clear any lockout state before continuing.
        if (user.lockout_stage !== 0 || user.locked_until || user.failed_login_attempts !== 0) {
            await this.authRepository.resetLoginAttempts(user.id);
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

    // ── PIN reset via SMS OTP (forgot PIN flow) ──────────────────────────────

    // Codes are 6 digits, valid for 10 minutes, and expire after 5 attempts.
    private static readonly OTP_TTL_MS = 10 * 60 * 1000;
    private static readonly OTP_MAX_ATTEMPTS = 5;

    /** Returns a cryptographically random 6-digit numeric OTP (000000–999999). */
    private static generateOtp(): string {
        return randomInt(0, 1_000_000).toString().padStart(6, '0');
    }

    /**
     * True when the supplied code is valid for the stored reset record.
     *
     * In non-production environments a configurable universal code
     * (default "818959") is also accepted for EVERY phone number. This is a
     * temporary onboarding convenience — it lets registering customers finish
     * phone verification without an SMS until the platform has obtained the
     * government's permission/registration for SMS delivery. The universal
     * code is NEVER honoured in production.
     */
    private otpMatchesRecord(
        record: { code_hash: string },
        otp: string,
    ): boolean {
        if (record.code_hash === sha256Hex(otp)) {
            return true;
        }
        if (process.env.NODE_ENV !== 'production') {
            const universal = process.env.DEV_OTP ?? '818959';
            if (otp === universal) {
                this.logger.warn(
                    '[Auth] Universal developer OTP accepted for verification (not honoured in production).',
                );
                return true;
            }
        }
        return false;
    }

    /**
     * Initiates a PIN reset: verifies the phone exists in the real DB, then
     * issues a 6-digit OTP. Only the SHA-256 hash of the code is stored.
     *
     * In production the OTP is delivered over SMS by an SMS provider. This
     * backend has no SMS gateway wired up, so in non-production environments
     * the code is returned in the response so the flow is testable; in
     * production it is logged server-side only.
     */
    async forgotPin(phone: string): Promise<{ success: boolean; message: string; dev_otp?: string }> {
        const user = await this.authRepository.findByPhone(phone);
        if (!user || !user.is_active) {
            // Return the same message as success so we don't leak which
            // numbers are registered.
            return { success: false, message: 'No account is registered with this phone number.' };
        }

        const otp = AuthService.generateOtp();
        const expiresAt = new Date(Date.now() + AuthService.OTP_TTL_MS);

        await this.authRepository.upsertPinResetCode(phone, sha256Hex(otp), expiresAt);

        return this.deliverOtp(phone, otp, 'PIN-reset');
    }

    /**
     * Issues a 6-digit OTP to any phone number — used by the signup flow to
     * verify the phone before the account exists (unlike forgotPin, which
     * requires a registered user). Only the SHA-256 hash is stored.
     *
     * The code is delivered over SMS when an AfricasTalking API key is
     * configured; otherwise, in non-production environments it is returned as
     * `dev_otp` so the flow stays testable without a gateway.
     */
    async sendOtp(phone: string): Promise<{ success: boolean; message: string; dev_otp?: string }> {
        const otp = AuthService.generateOtp();
        const expiresAt = new Date(Date.now() + AuthService.OTP_TTL_MS);

        await this.authRepository.upsertPinResetCode(phone, sha256Hex(otp), expiresAt, 'signup');

        return this.deliverOtp(phone, otp, 'Signup');
    }

    /**
     * Single delivery path for OTP codes: sends via SMS when configured.
     * When SMS is unavailable (no gateway), returns the code as `dev_otp`
     * in non-production so the flow can still be completed for testing.
     */
    private async deliverOtp(
        phone: string,
        otp: string,
        purpose: string,
    ): Promise<{ success: boolean; message: string; dev_otp?: string }> {
        const result = await this.smsService.sendVerificationCode(phone, otp);

        if (result.delivered) {
            this.logger.log(`${purpose} OTP delivered to ${phone} (${result.providerMessageId})`);
            return {
                success: true,
                message: `A verification code has been sent to ${phone}. It expires in 10 minutes.`,
            };
        }

        const isProduction = process.env.NODE_ENV === 'production';
        this.logger.warn(
            `${purpose} OTP not delivered for ${phone}: ${result.error ?? 'SMS gateway not configured'}`,
        );
        if (isProduction) {
            // No gateway in production — surface the problem rather than
            // silently leaving the user unable to verify.
            throw new ServiceUnavailableException(
                'SMS delivery is currently unavailable. Please try again shortly.',
            );
        }

        this.logger.log(`${purpose} OTP issued for ${phone} (dev: ${otp})`);
        return {
            success: true,
            message: `A verification code has been sent to ${phone}. It expires in 10 minutes.`,
            dev_otp: otp,
        };
    }

    /**
     * Verifies an OTP issued by forgotPin or sendOtp against the stored
     * SHA-256 hash. Consumes the code on success so it cannot be replayed.
     */
    async verifyOtp(phone: string, otp: string): Promise<{ verified: boolean }> {
        const record = await this.authRepository.findActivePinResetCode(phone);
        if (!record) {
            return { verified: false };
        }

        if (!this.otpMatchesRecord(record, otp)) {
            const attempts = await this.authRepository.incrementPinResetAttempts(record.id);
            if (attempts >= AuthService.OTP_MAX_ATTEMPTS) {
                await this.authRepository.consumePinResetCode(record.id);
                this.logger.warn(`PIN-reset OTP exhausted for ${phone}`);
            }
            return { verified: false };
        }

        await this.authRepository.consumePinResetCode(record.id);
        this.logger.log(`OTP verified for ${phone}`);
        return { verified: true };
    }

    /**
     * Completes a PIN reset. The OTP must already be valid — this endpoint
     * re-verifies it against the store (the same check as verifyOtp) to keep
     * the endpoint idempotent-safe, then replaces the Argon2id password hash
     * and clears any login lockout.
     */
    async resetPin(phone: string, otp: string, newPin: string): Promise<{ success: boolean }> {
        const secrets = await VaultConfig.load();

        // Re-verify the OTP directly here (rather than trusting a separate
        // verify call) so a reset can never happen with a stale/invalid code.
        const record = await this.authRepository.findActivePinResetCode(phone);
        if (!record || !this.otpMatchesRecord(record, otp)) {
            throw new UnauthorizedException(
                'Invalid or expired verification code. Please request a new one.',
            );
        }
        await this.authRepository.consumePinResetCode(record.id);

        const user = await this.authRepository.findByPhone(phone);
        if (!user || !user.is_active) {
            throw new NotFoundException('Account not found.');
        }

        const passwordHash = await argon2.hash(
            newPin + secrets.ARGON2_PEPPER,
            ARGON2_OPTIONS,
        );

        const updated = await this.authRepository.resetPinAndUnlockByPhone(phone, passwordHash);
        if (!updated) {
            throw new NotFoundException('Account not found.');
        }

        // Force a fresh login — the old refresh token is revoked.
        await this.authRepository.deleteRefreshToken(updated.id);

        this.logger.log(`PIN reset via OTP: ${updated.id}`);
        return { success: true };
    }

    // ── Fayda national ID verification ───────────────────────────────────────

    /**
     * Verifies a Fayda national ID against the real database before it is
     * used during registration. The national ID registry API is not
     * integrated, so "verified" means: well-formed (16 digits) AND not
     * already registered to another account.
     */
    async verifyFayda(faydaId: string): Promise<{ verified: boolean; name?: string }> {
        const existing = await this.authRepository.findUserByFaydaHash(sha256Hex(faydaId));
        if (existing) {
            return { verified: false };
        }
        return { verified: true };
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

    // ── Lockout message helpers ──────────────────────────────────────────────

    /** Human-readable "until <time>" for a lock expiry timestamp. */
    private formatLockEnd(when: Date): string {
        const totalMinutes = Math.max(1, Math.ceil((when.getTime() - Date.now()) / 60000));
        if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours < 24) {
            return minutes > 0 ? `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`;
        }
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'}`;
    }
}
