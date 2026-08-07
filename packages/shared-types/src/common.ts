/**
 * Common shared types used across backend and frontend.
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

export type UserRole = 'admin' | 'member' | 'guest';

export interface JwtPayload {
    sub: string;       // user UUID
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
