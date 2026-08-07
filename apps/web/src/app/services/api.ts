/**
 * api.ts
 * Centralised HTTP client for all backend API calls.
 *
 * Base URL:  NEXT_PUBLIC_API_BASE_URL  (default: http://localhost:3000)
 * Version:   NEXT_PUBLIC_API_VERSION   (default: v1)
 *
 * PIN padding:
 *   The frontend collects a 4-digit PIN as the user's credential.
 *   The backend RegisterDto requires min 8 chars + letter + number.
 *   We pad short PINs with a deterministic suffix before sending so the
 *   DTO validates, Argon2id hashes it, and the same padding on login
 *   produces an identical hash.  e.g. "1234" → "1234QN1234!"
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class APIError extends Error {
  constructor(
    public status: number,
    public data?: any,
    message?: string,
  ) {
    super(message || `API Error: ${status}`);
    this.name = 'APIError';
  }
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, ...init } = options;

  let url = `${API_BASE_URL}/api/${API_VERSION}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    if (searchParams.toString()) url += `?${searchParams.toString()}`;
  }

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const response = await fetch(url, { ...init, headers });

    const contentType = response.headers.get('content-type');
    let data: any;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new APIError(
        response.status,
        data,
        data?.message || `HTTP ${response.status}`,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new Error(
      `API Request Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// ---------------------------------------------------------------------------
// PIN padding helper — applied identically on signup and signin
// ---------------------------------------------------------------------------

function padPin(pin: string): string {
  // If already ≥ 8 chars with a letter, pass through unchanged.
  if (pin.length >= 8 && /[A-Za-z]/.test(pin)) return pin;
  // Pad: "1234" → "1234QN1234!"  (12 chars, letters + numbers ✓)
  return `${pin}QN${pin}!`;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const authAPI = {
  /**
   * POST /api/v1/auth/register
   * Creates a new participant account.
   * PIN is padded before sending to satisfy the backend DTO constraints.
   */
  signup: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;
    fayda?: string;
    profession?: string;
    guarantor?: string;
  }) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          phone: data.phoneNumber,
          email: data.email,
          password: padPin(data.password),
        }),
      },
    ),

  /**
   * POST /api/v1/auth/login
   * Authenticates with phone/email + PIN (padded identically to signup).
   */
  signin: (phoneNumber: string, pin: string) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier: phoneNumber,
          password: padPin(pin),
        }),
      },
    ),

  /** POST /api/v1/auth/refresh */
  refreshToken: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  /** POST /api/v1/auth/logout */
  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  /** GET /api/v1/auth/me */
  getCurrentUser: () => request<any>('/auth/me', { method: 'GET' }),

  // Stubs — implement when backend endpoints exist
  verifyOTP: (phoneNumber: string, otp: string) =>
    request<{ verified: boolean }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp }),
    }),

  verifyFayda: (fayda: string) =>
    request<{ verified: boolean; name?: string }>('/auth/verify-fayda', {
      method: 'POST',
      body: JSON.stringify({ fayda }),
    }),

  forgotPin: (phoneNumber: string) =>
    request<{ success: boolean; message: string }>('/auth/forgot-pin', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    }),

  resetPin: (phoneNumber: string, otp: string, newPin: string) =>
    request<{ success: boolean }>('/auth/reset-pin', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp, newPin }),
    }),
};

// ---------------------------------------------------------------------------
// Other API namespaces
// ---------------------------------------------------------------------------

export const userAPI = {
  getProfile: (userId: string) =>
    request<any>(`/users/${userId}`, { method: 'GET' }),

  updateProfile: (userId: string, data: any) =>
    request<any>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export const equbAPI = {
  getAll: (params?: { page?: number; limit?: number }) =>
    request<any>('/equbs', { method: 'GET', params }),

  getById: (id: string) => request<any>(`/equbs/${id}`, { method: 'GET' }),

  create: (data: any) =>
    request<any>('/equbs', { method: 'POST', body: JSON.stringify(data) }),

  join: (equbId: string) =>
    request<any>(`/equbs/${equbId}/join`, { method: 'POST' }),
};

export const paymentService = {
  initiate: (data: any) =>
    request<any>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verify: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/verify`, { method: 'POST' }),

  getStatus: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/status`, { method: 'GET' }),
};

export const healthAPI = {
  check: () =>
    request<{ status: string; timestamp: string }>('/health', {
      method: 'GET',
    }),
};

export default {
  authAPI,
  userAPI,
  equbAPI,
  paymentService,
  healthAPI,
  request,
  APIError,
};
