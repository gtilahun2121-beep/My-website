// ========================================================================
// AUTHENTICATION & SECURITY UTILITIES
// ========================================================================

import { User, UserRole, AuthToken } from '../data';

// ========================================================================
// JWT TOKEN MANAGEMENT
// ========================================================================

interface DecodedToken {
  sub: string;
  id: string;
  phone: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

export class JwtService {
  /**
   * Decode a JWT token without verification (for client-side use only)
   * Always verify on the backend
   */
  static decode(token: string): DecodedToken | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );
      return decoded as DecodedToken;
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }

  static isExpired(token: string): boolean {
    const decoded = this.decode(token);
    if (!decoded) return true;

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  }

  static getExpiresIn(token: string): number {
    const decoded = this.decode(token);
    if (!decoded) return 0;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - now);
  }
}

// ========================================================================
// AUTHENTICATION STATE MANAGEMENT
// ========================================================================

export interface AuthState {
  user: User | null;
  token: AuthToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'qalnet_access_token',
  REFRESH_TOKEN: 'qalnet_refresh_token',
  USER: 'qalnet_user',
};

export class AuthManager {
  private static instance: AuthManager;
  private state: AuthState;
  private listeners: Array<(state: AuthState) => void> = [];

  private constructor() {
    this.state = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    };
    this.restoreSession();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private restoreSession(): void {
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const user = localStorage.getItem(STORAGE_KEYS.USER);

      if (accessToken && !JwtService.isExpired(accessToken) && user) {
        this.state = {
          user: JSON.parse(user),
          token: { accessToken, tokenType: 'Bearer', expiresIn: JwtService.getExpiresIn(accessToken) },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      } else {
        this.clearSession();
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.clearSession();
    }
  }

  private setState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach((listener) => listener(this.state));
  }

  setSession(user: User, token: AuthToken): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token.accessToken);
    if (token.refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token.refreshToken);
    }
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    this.setState({
      user,
      token,
      isAuthenticated: true,
      error: null,
    });
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);

    this.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getAccessToken(): string | null {
    return this.state.token?.accessToken || null;
  }

  getUser(): User | null {
    return this.state.user || null;
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  hasRole(role: UserRole | UserRole[]): boolean {
    if (!this.state.user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(this.state.user.role);
  }

  canAccess(requiredRoles: UserRole[]): boolean {
    return this.hasRole(requiredRoles);
  }
}

// ========================================================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ========================================================================

export const RBAC = {
  // Participant permissions
  PARTICIPANT_PERMISSIONS: [
    'view_equbs',
    'join_equb',
    'make_payment',
    'view_wallet',
    'vote_on_proposal',
    'request_support',
  ],

  // Host permissions
  HOST_PERMISSIONS: [
    ...['view_equbs', 'join_equb', 'make_payment', 'view_wallet', 'vote_on_proposal'],
    'create_equb',
    'manage_members',
    'manage_payouts',
    'approve_payments',
    'view_host_dashboard',
  ],

  // Admin permissions
  ADMIN_PERMISSIONS: [
    'view_all_equbs',
    'view_all_users',
    'manage_all_payments',
    'override_transactions',
    'resolve_disputes',
    'view_admin_dashboard',
    'manage_system_settings',
    'view_audit_logs',
  ],

  // Auditor permissions
  AUDITOR_PERMISSIONS: [
    'view_all_equbs',
    'view_all_users',
    'view_all_transactions',
    'generate_reports',
    'view_audit_logs',
  ],

  canPerform(userRole: UserRole, action: string): boolean {
    const permissions = {
      participant: this.PARTICIPANT_PERMISSIONS,
      host: this.HOST_PERMISSIONS,
      admin: this.ADMIN_PERMISSIONS,
      system_auditor: this.AUDITOR_PERMISSIONS,
    };

    return permissions[userRole]?.includes(action) || false;
  },

  getPermissions(userRole: UserRole): string[] {
    const permissions = {
      participant: this.PARTICIPANT_PERMISSIONS,
      host: this.HOST_PERMISSIONS,
      admin: this.ADMIN_PERMISSIONS,
      system_auditor: this.AUDITOR_PERMISSIONS,
    };

    return permissions[userRole] || [];
  },
};

// ========================================================================
// ENCRYPTION UTILITIES (CLIENT-SIDE)
// ========================================================================

export class EncryptionService {
  /**
   * Simple base64 encoding for non-sensitive client-side data
   * Real sensitive data should be encrypted on backend with pgcrypto
   */
  static encode(data: string): string {
    try {
      return Buffer.from(data).toString('base64');
    } catch (error) {
      console.error('Encoding failed:', error);
      return '';
    }
  }

  static decode(encoded: string): string {
    try {
      return Buffer.from(encoded, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Decoding failed:', error);
      return '';
    }
  }

  /**
   * Hash a value using SubtleCrypto (Web Crypto API)
   * For device-specific sensitive data only
   */
  static async hash(value: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hashing failed:', error);
      return '';
    }
  }

  /**
   * Generate a random device token for local storage
   */
  static generateDeviceToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

// ========================================================================
// RATE LIMITING & THROTTLING
// ========================================================================

export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 5 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter((time) => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }

  getRemainingTime(key: string): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;

    const oldestAttempt = attempts[0];
    const remainingTime = this.windowMs - (Date.now() - oldestAttempt);
    return Math.max(0, remainingTime);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export const loginRateLimiter = new RateLimiter(5, 5 * 60 * 1000); // 5 attempts per 5 minutes
export const otpRateLimiter = new RateLimiter(3, 10 * 60 * 1000); // 3 attempts per 10 minutes

// ========================================================================
// SESSION VALIDATION
// ========================================================================

export class SessionValidator {
  static isSessionValid(): boolean {
    const authManager = AuthManager.getInstance();
    const state = authManager.getState();

    if (!state.isAuthenticated || !state.token) {
      return false;
    }

    return !JwtService.isExpired(state.token.accessToken);
  }

  static shouldRefreshToken(): boolean {
    const authManager = AuthManager.getInstance();
    const token = authManager.getAccessToken();

    if (!token) return false;

    const expiresIn = JwtService.getExpiresIn(token);
    // Refresh if token expires in less than 5 minutes
    return expiresIn < 5 * 60;
  }

  static validatePhoneNumber(phone: string): boolean {
    // Ethiopian phone number format: +251xxx... or 0xxx...
    const ethiopianPhoneRegex = /^(\+251|0)(9|7)[0-9]{8}$/;
    return ethiopianPhoneRegex.test(phone.replace(/\s/g, ''));
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default {
  JwtService,
  AuthManager,
  RBAC,
  EncryptionService,
  RateLimiter,
  SessionValidator,
};
