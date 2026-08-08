/**
 * authService.ts — DEPRECATED LOCAL-ONLY STUB
 *
 * ⚠️  SECURITY WARNING: This file was originally a local-only authentication
 * stub that stored PINs in plaintext in localStorage. It has been replaced
 * by the real backend API calls in api.ts + AuthContext.tsx.
 *
 * DO NOT USE THIS FILE FOR NEW FEATURES.
 * DO NOT STORE CREDENTIALS IN LOCALSTORAGE.
 *
 * This file is kept only to avoid breaking any existing imports.
 * It now re-exports from the canonical auth sources.
 *
 * Migration guide:
 *   - Authentication: use useAuth() from AuthContext.tsx
 *   - API calls: use authAPI from api.ts
 *   - Validation utilities: use SessionValidator from auth.ts
 */

// Re-export utilities from the canonical auth module
export { SessionValidator, loginRateLimiter, RateLimiter } from './auth';

// ---------------------------------------------------------------------------
// Legacy types — kept for backward compatibility
// These types have been superseded by the shared-types package.
// ---------------------------------------------------------------------------

import type { UserRole } from '@qalnet/shared-types';

/** @deprecated Use UserProfile from @qalnet/shared-types instead */
export interface RegistrationData {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  pin: string;        // ⚠️ NEVER store or log PINs; this is legacy
  faydaNumber: string;
}

/** @deprecated Use authAPI.signin() from api.ts + useAuth() from AuthContext */
export interface LoginCredentials {
  phoneNumber: string;
  pin: string; // ⚠️ NEVER store or log PINs; this is legacy
}

/** @deprecated Admin authentication must go through the backend, not localStorage */
export type AdminRoleType = 'super_admin' | 'kyc_approver' | 'dispute_manager' | 'finance_auditor';

/**
 * @deprecated
 * The old AuthService stored users and PINs in localStorage.
 * This is not secure and not connected to the real backend.
 * Use useAuth() from AuthContext.tsx for all authentication.
 */
export class AuthService {
  static isValidPhone(phone: string): boolean {
    // Matches the backend RegisterDto regex: +251[79]\d{8}
    return /^\+251[79]\d{8}$/.test(phone);
  }

  static isValidPin(pin: string): boolean {
    return /^\d{4,8}$/.test(pin);
  }

  /**
   * @deprecated
   * Legacy: used to look up users from localStorage.
   * The real backend now handles all user lookups.
   */
  static getCurrentUser(): null {
    console.warn(
      '[AuthService] getCurrentUser() is deprecated. Use useAuth() from AuthContext.tsx instead.',
    );
    return null;
  }

  /**
   * @deprecated
   * Hardcoded admin credentials have been removed as a security fix.
   * Admin authentication must go through the real backend /api/v1/auth/login endpoint.
   */
  static async adminLogin(_credentials: { email: string; masterPassword: string }): Promise<never> {
    throw new Error(
      'Direct admin login via AuthService is no longer supported. ' +
      'Admin users must authenticate via the backend API at POST /api/v1/auth/login.',
    );
  }
}

export default AuthService;
