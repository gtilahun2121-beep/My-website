/**
 * Common shared types used across backend and frontend.
 *
 * CANONICAL SOURCE OF TRUTH — do not define these elsewhere.
 * Backend DB enum: user_role = 'participant' | 'host' | 'admin'
 */

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Matches Postgres `user_role` enum exactly.
 * Do NOT use 'member' or 'guest' — those are not real DB roles.
 */
export type UserRole = 'participant' | 'host' | 'admin';

/**
 * Full JWT payload signed by the backend (spec §1.2).
 * Maps to the RS256 access token claims.
 */
export interface JwtPayload {
    sub: string;        // user UUID
    phone: string;
    email: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    trust_tier: string; // 'standard' | 'bronze' | 'silver' | 'gold' | 'verified_trust'
    jti: string;        // unique token ID
    iat?: number;
    exp?: number;
}

/**
 * Trust tier values — matches Postgres `trust_tier` enum.
 */
export type TrustTier = 'standard' | 'bronze' | 'silver' | 'gold' | 'verified_trust';
