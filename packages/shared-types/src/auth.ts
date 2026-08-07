/**
 * Auth-related shared types.
 * Mirror of backend DTOs — kept in sync here so the frontend
 * doesn't need to duplicate type definitions.
 */

export interface RegisterRequest {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface AuthTokens {
    accessToken: string;
    /** Refresh token is sent as an HttpOnly cookie — not in the response body */
    expiresIn: number;
}

export interface UserProfile {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    role: import('./common').UserRole;
    isVerified: boolean;
    createdAt: string;
}

export interface RefreshTokenRequest {
    /** Sent automatically via HttpOnly cookie — not required in body */
    refreshToken?: string;
}
