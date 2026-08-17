/**
 * Auth-related shared types.
 *
 * These mirror the backend DTOs and controller response shapes EXACTLY.
 * Changes here must be kept in sync with:
 *   - apps/backend/src/modules/auth/dto/register.dto.ts
 *   - apps/backend/src/modules/auth/dto/login.dto.ts
 *   - apps/backend/src/modules/auth/auth.controller.ts
 *   - apps/backend/src/modules/auth/auth.service.ts (JwtPayload)
 */

import { UserRole } from './common';

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/auth/register.
 * All fields are snake_case to match the backend RegisterDto directly.
 */
export interface RegisterRequest {
    first_name: string;       // min 1, max 100
    last_name: string;        // min 1, max 100
    email: string;            // valid email, max 255
    /**
     * The raw password (or padded PIN) sent to the backend.
     * Frontend pads 4-digit PINs: "1234" → "1234QN1234!" before sending.
     * Min 8 chars, must contain letter + number.
     */
    password: string;
    phone: string;            // +251[79]\d{8} E.164 format
    fayda_id: string;         // exactly 16 digits
    telegram_handle?: string; // optional, @handle format
}

// ── Login ────────────────────────────────────────────────────────────────────

/**
 * Payload for POST /api/v1/auth/login.
 * `identifier` accepts either a phone number (+251...) or an email address.
 */
export interface LoginRequest {
    identifier: string; // phone OR email — NOT just email
    /**
     * The raw password (or padded PIN).
     * Must be padded identically to registration: "1234" → "1234QN1234!"
     */
    password: string;
}

// ── Token Response ────────────────────────────────────────────────────────────

/**
 * Response body from /register, /login, and /refresh.
 * Note: the refresh token is ALSO sent as an HttpOnly cookie (qalnet_refresh).
 * Browser clients should rely on the cookie; mobile/USSD clients use the body.
 * Fields are snake_case to match the backend JSON response exactly.
 */
export interface AuthTokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
}

/**
 * Response from /login when the account has 2FA enabled.
 * The caller must complete /verify-2fa with the returned mfa_token.
 */
export interface TwoFactorRequiredResponse {
    two_factor_required: true;
    mfa_token: string;
}

/** Union of the two possible /login responses. */
export type LoginResponse = AuthTokenResponse | TwoFactorRequiredResponse;

// ── Two-factor authentication (TOTP) ────────────────────────────────────────────

/** Response from POST /api/v1/auth/2fa/setup */
export interface TwoFactorSetupResponse {
    secret: string;
    otpauth_url: string;
}

/** Response from POST /api/v1/auth/2fa/verify */
export interface TwoFactorVerifyResponse {
    enabled: boolean;
    backup_codes: string[];
}

/** Response from POST /api/v1/auth/2fa/disable */
export interface TwoFactorDisableResponse {
    enabled: boolean;
}

/** Response from GET /api/v1/auth/2fa/status */
export interface TwoFactorStatusResponse {
    enabled: boolean;
    backup_codes_count: number;
}

/** Payload for POST /api/v1/auth/2fa/verify and /api/v1/auth/2fa/disable */
export interface TwoFactorCodeRequest {
    code: string;
}

/** Payload for POST /api/v1/auth/verify-2fa */
export interface TwoFactorLoginRequest {
    mfa_token: string;
    code: string;
}

// ── Refresh ───────────────────────────────────────────────────────────────────

/**
 * Optional body for POST /api/v1/auth/refresh.
 * Browser clients send the cookie automatically; only needed for non-browser.
 */
export interface RefreshTokenRequest {
    refresh_token?: string;
}

// ── Logout ────────────────────────────────────────────────────────────────────

/** Response from POST /api/v1/auth/logout */
export interface LogoutResponse {
    message: string;
}

// ── User Profile (decoded from JWT) ──────────────────────────────────────────

/**
 * User profile hydrated from the decoded JWT access token.
 * Maps directly from JwtPayload fields.
 */
export interface UserProfile {
    id: string;          // sub claim
    phone: string;
    email: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    trust_tier: string;
}

// ── OTP / PIN reset (forgot PIN flow) ─────────────────────────────────────────

/** Payload for POST /api/v1/auth/forgot-pin */
export interface ForgotPinRequest {
    phone: string; // +251[79]\d{8} E.164 format
}

/** Response from POST /api/v1/auth/forgot-pin */
export interface ForgotPinResponse {
    success: boolean;
    message: string;
    /** Present only outside production when no SMS gateway is configured. */
    dev_otp?: string;
}

/** Payload for POST /api/v1/auth/verify-otp */
export interface VerifyOtpRequest {
    phone: string;
    otp: string; // exactly 6 digits
}

/** Response from POST /api/v1/auth/verify-otp */
export interface VerifyOtpResponse {
    verified: boolean;
}

/** Payload for POST /api/v1/auth/reset-pin */
export interface ResetPinRequest {
    phone: string;
    otp: string; // exactly 6 digits
    new_pin: string; // padded PIN: "1234QN1234!"
}

/** Response from POST /api/v1/auth/reset-pin */
export interface ResetPinResponse {
    success: boolean;
}

/** Payload for POST /api/v1/auth/verify-fayda */
export interface VerifyFaydaRequest {
    fayda_id: string; // exactly 16 digits
}

/** Response from POST /api/v1/auth/verify-fayda */
export interface VerifyFaydaResponse {
    verified: boolean;
    name?: string;
}
