'use client';

/**
 * AuthContext.tsx
 *
 * Provides authentication state and methods to the entire frontend app.
 *
 * Key design decisions:
 *  - Access token stored in localStorage under 'authToken' (read by api.ts).
 *  - Refresh token stored in localStorage under 'refreshToken' as backup;
 *    the backend also sets it as an HttpOnly cookie (qalnet_refresh).
 *  - User profile is hydrated from the decoded JWT payload (no separate /me call needed).
 *  - UserRole matches the backend DB enum: 'participant' | 'host' | 'admin'.
 *    Do NOT map 'participant' → 'member' or use 'guest' — those are legacy values
 *    that will break RBAC guards.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { authAPI, APIError } from '@/app/services/api';
import type { UserRole, JwtPayload } from '@qalnet/shared-types';

// ---------------------------------------------------------------------------
// User type — derived from the JWT payload + UI state
// ---------------------------------------------------------------------------

export interface User {
  id: string;           // sub claim from JWT
  firstName: string;    // first_name from JWT
  lastName: string;     // last_name from JWT
  email: string;        // email from JWT
  phoneNumber: string;  // phone from JWT
  role: UserRole;       // 'participant' | 'host' | 'admin'
  trustTier: string;    // trust_tier from JWT
  createdAt: string;    // ISO timestamp (set to now at login time)
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;     // 4-digit PIN — padded by api.ts before sending
  phoneNumber: string;
  fayda: string;        // 16-digit Fayda national ID
  telegramHandle?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signin: (identifier: string, pin: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  signout: () => Promise<void>;
  /**
   * Resets the user's PIN via the backend.
   * NOTE: The backend does not yet expose a PIN-reset endpoint.
   * This calls POST /api/v1/auth/reset-pin when it becomes available.
   * Until then it throws an informative error.
   */
  resetPin: (phoneNumber: string, newPin: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Storage keys — single source of truth to prevent conflicts across services
// ---------------------------------------------------------------------------

const STORAGE = {
  ACCESS_TOKEN: 'authToken',       // used by api.ts request() helper
  REFRESH_TOKEN: 'refreshToken',
  USER: 'qalnet_user',
} as const;

// ---------------------------------------------------------------------------
// JWT decode helper (client-side, no verification)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(
      // Use atob for browser compatibility; Buffer for SSR edge cases
      typeof window !== 'undefined'
        ? atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(parts[1], 'base64url').toString(),
    );
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Hydrates a User object from the decoded JWT payload.
 * Falls back to form data when JWT fields are missing.
 */
function userFromJwt(payload: JwtPayload, fallback?: Partial<User>): User {
  return {
    id: payload.sub,
    firstName: payload.first_name || fallback?.firstName || '',
    lastName: payload.last_name || fallback?.lastName || '',
    email: payload.email || fallback?.email || '',
    phoneNumber: payload.phone || fallback?.phoneNumber || '',
    // Role from JWT is authoritative — never remap 'participant' → 'member'
    role: payload.role || 'participant',
    trustTier: payload.trust_tier || 'standard',
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const storedToken = localStorage.getItem(STORAGE.ACCESS_TOKEN);
    const storedUser = localStorage.getItem(STORAGE.USER);

    if (storedToken && storedUser) {
      try {
        // Verify the token is not expired before restoring
        const payload = decodeJwtPayload(storedToken);
        const now = Math.floor(Date.now() / 1000);

        if (payload && payload.exp && payload.exp > now) {
          setUser(JSON.parse(storedUser) as User);
        } else {
          // Token expired — clear stale session
          localStorage.removeItem(STORAGE.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE.REFRESH_TOKEN);
          localStorage.removeItem(STORAGE.USER);
        }
      } catch {
        localStorage.removeItem(STORAGE.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE.USER);
      }
    }

    setIsLoading(false);
  }, []);

  // ── signin ──────────────────────────────────────────────────────────────────

  const signin = useCallback(async (identifier: string, pin: string) => {
    setIsLoading(true);
    try {
      // api.ts handles PIN padding and sends { identifier, password: padPin(pin) }
      const response = await authAPI.signin(identifier, pin);

      const payload = decodeJwtPayload(response.access_token);
      if (!payload) throw new Error('Invalid token received from server.');

      const userData = userFromJwt(payload, { phoneNumber: identifier });

      setUser(userData);
      localStorage.setItem(STORAGE.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE.USER, JSON.stringify(userData));
      if (response.refresh_token) {
        localStorage.setItem(STORAGE.REFRESH_TOKEN, response.refresh_token);
      }
    } catch (error) {
      const message =
        error instanceof APIError
          ? error.data?.message || error.message
          : error instanceof Error
            ? error.message
            : 'Sign in failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── signup ──────────────────────────────────────────────────────────────────

  const signup = useCallback(async (data: SignupData) => {
    setIsLoading(true);
    try {
      // api.ts maps camelCase → snake_case and pads the PIN before sending
      const response = await authAPI.signup({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phoneNumber: data.phoneNumber,
        fayda: data.fayda,
        telegramHandle: data.telegramHandle,
      });

      const payload = decodeJwtPayload(response.access_token);
      if (!payload) throw new Error('Invalid token received from server.');

      const userData = userFromJwt(payload, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
      });

      setUser(userData);
      localStorage.setItem(STORAGE.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE.USER, JSON.stringify(userData));
      if (response.refresh_token) {
        localStorage.setItem(STORAGE.REFRESH_TOKEN, response.refresh_token);
      }
    } catch (error) {
      const message =
        error instanceof APIError
          ? error.data?.message || error.message
          : error instanceof Error
            ? error.message
            : 'Sign up failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── signout ─────────────────────────────────────────────────────────────────

  const signout = useCallback(async () => {
    try {
      // Tell the backend to revoke the refresh token
      await authAPI.logout();
    } catch {
      // Ignore errors on logout — clear the session regardless
    } finally {
      setUser(null);
      localStorage.removeItem(STORAGE.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE.USER);
    }
  }, []);

  // ── resetPin ─────────────────────────────────────────────────────────────

  const resetPin = useCallback(async (_phoneNumber: string, _newPin: string) => {
    // TODO: Call POST /api/v1/auth/reset-pin when the backend exposes this endpoint.
    // For now we throw a user-friendly message so the UI can show a toast.
    throw new Error(
      'PIN reset via SMS OTP is not yet available. Please contact support to reset your PIN.',
    );
  }, []);

  // ── context value ───────────────────────────────────────────────────────────

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signin,
    signup,
    signout,
    resetPin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
