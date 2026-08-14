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
import { authAPI, userAPI, APIError } from '@/app/services/api';
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
  profilePhoto?: string | null; // base64 data URL, from GET /users/me
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
   * Re-fetches GET /users/me and syncs the persisted profile (e.g. profile photo).
   */
  refreshProfile: () => Promise<void>;
  /**
   * Updates the in-memory + persisted user with a new profile photo (data URL).
   */
  updateProfilePhoto: (photo: string | null) => void;
  /**
   * Merges profile edits (name/phone/email) into the in-memory + persisted
   * user so dashboards re-render with the latest details immediately.
   */
  updateUser: (patch: Partial<User>) => void;
  /**
   * Resets the user's PIN via the backend's SMS-OTP flow.
   * Calls POST /api/v1/auth/reset-pin — the OTP must already be issued
   * (via /auth/forgot-pin) and verified for the reset to succeed.
   */
  resetPin: (phoneNumber: string, newPin: string, otp: string) => Promise<void>;
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

  // Pull persisted profile data (e.g. profile photo) from the backend and
  // merge it into the current user + storage. Best-effort — never throws.
  const syncProfile = useCallback(async () => {
    try {
      const profile = await userAPI.getProfile();
      if (!profile) return;
      setUser((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          profilePhoto: profile.profile_photo ?? null,
          // Sync the freshest identity fields from the backend (handles the
          // case where the profile was edited while the JWT is still stale).
          firstName: profile.first_name || prev.firstName,
          lastName: profile.last_name || prev.lastName,
          phoneNumber: profile.phone || prev.phoneNumber,
          email: profile.email || prev.email,
        };
        localStorage.setItem(STORAGE.USER, JSON.stringify(next));
        return next;
      });
    } catch {
      // profile fetch is best-effort
    }
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Defer the synchronous restore to a microtask so state updates never run
    // inside the effect body (keeps the initial render consistent on both
    // server and client — first paint is always unauthenticated).
    queueMicrotask(() => {
      void (async () => {
        const storedToken = localStorage.getItem(STORAGE.ACCESS_TOKEN);
        const storedUser = localStorage.getItem(STORAGE.USER);
        const storedRefresh = localStorage.getItem(STORAGE.REFRESH_TOKEN);

        if (!storedToken || !storedUser) {
          setIsLoading(false);
          return;
        }

        const payload = decodeJwtPayload(storedToken);
        const now = Math.floor(Date.now() / 1000);
        const tokenValid = !!payload && !!payload.exp && payload.exp > now;

        try {
          if (!tokenValid && storedRefresh) {
            // Access token expired but a refresh token exists — rotate silently
            // so an admin reloading the dashboard stays signed in.
            const response = await authAPI.refreshToken(storedRefresh);
            const freshPayload = decodeJwtPayload(response.access_token);
            if (!freshPayload) throw new Error('Invalid refreshed token');

            const userData = userFromJwt(freshPayload, JSON.parse(storedUser) as Partial<User>);
            setUser(userData);
            localStorage.setItem(STORAGE.ACCESS_TOKEN, response.access_token);
            localStorage.setItem(STORAGE.USER, JSON.stringify(userData));
            if (response.refresh_token) {
              localStorage.setItem(STORAGE.REFRESH_TOKEN, response.refresh_token);
            }
            // Sync profile in background — don't block isLoading on the network call
            void syncProfile();
            setIsLoading(false);
            return;
          }

          if (tokenValid) {
            setUser(JSON.parse(storedUser) as User);
            // Sync profile in background — don't block isLoading on the network call
            void syncProfile();
            setIsLoading(false);
            return;
          }
        } catch {
          // Fall through — no usable refresh path, clear the session.
        }

        // Token expired with no usable refresh token — clear stale session.
        localStorage.removeItem(STORAGE.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE.USER);
        setIsLoading(false);
      })();
    });
  }, [syncProfile]);

  // ── profile photo ────────────────────────────────────────────────────────

  const updateProfilePhoto = useCallback((photo: string | null) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, profilePhoto: photo };
      localStorage.setItem(STORAGE.USER, JSON.stringify(next));
      return next;
    });
  }, []);

  // Merges profile edits (e.g. name/phone/email from the profile page) into
  // the current user and persisted storage so every consumer (member
  // dashboard, admin sidebar, header) reflects the change immediately.
  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE.USER, JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await userAPI.getProfile();
      if (!profile) return;
      setUser((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          profilePhoto: profile.profile_photo ?? null,
          // The backend is the source of truth for identity after a profile
          // edit — keep in-memory state in sync even though the JWT is stale.
          firstName: profile.first_name || prev.firstName,
          lastName: profile.last_name || prev.lastName,
          phoneNumber: profile.phone || prev.phoneNumber,
          email: profile.email || prev.email,
        };
        localStorage.setItem(STORAGE.USER, JSON.stringify(next));
        return next;
      });
    } catch {
      // profile fetch is best-effort
    }
  }, [setUser]);

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
      void refreshProfile();
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
  }, [refreshProfile]);

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

  const resetPin = useCallback(async (phoneNumber: string, newPin: string, otp: string) => {
    try {
      // api.ts pads the new PIN and POSTs /auth/reset-pin with the OTP
      await authAPI.resetPin(phoneNumber, otp, newPin);
    } catch (error) {
      const message =
        error instanceof APIError
          ? error.data?.message || error.message
          : error instanceof Error
            ? error.message
            : 'Failed to reset your PIN';
      throw new Error(message);
    }
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
    refreshProfile,
    updateProfilePhoto,
    updateUser,
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
