/**
 * API Service
 * Centralized HTTP client for all backend API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

export class APIError extends Error {
  constructor(
    public status: number,
    public data?: any,
    message?: string
  ) {
    super(message || `API Error: ${status}`);
    this.name = 'APIError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

/**
 * Make an API request
 */
async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...init } = options;

  // Build URL with query parameters
  let url = `${API_BASE_URL}/api/${API_VERSION}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    if (searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }
  }

  // Get auth token from localStorage if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  // Set default headers
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new APIError(
        response.status,
        data,
        data?.message || `HTTP ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new Error(`API Request Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Authentication API Endpoints
 */
export const authAPI = {
  /**
   * Sign up - Create new account
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
    request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>('/auth/register', {
      method: 'POST',
      // Map frontend field names → backend RegisterDto field names
      body: JSON.stringify({
        phone: data.phoneNumber,
        email: data.email,
        password: data.password,
      }),
    }),

  /**
   * Sign in - Login with phone/email + password
   */
  signin: (phoneNumber: string, pin: string) =>
    request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>('/auth/login', {
      method: 'POST',
      // Map frontend field names → backend LoginDto field names
      body: JSON.stringify({ identifier: phoneNumber, password: pin }),
    }),

  /**
   * Verify OTP
   */
  verifyOTP: (phoneNumber: string, otp: string) =>
    request<{ verified: boolean }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp }),
    }),

  /**
   * Verify Fayda ID
   */
  verifyFayda: (fayda: string) =>
    request<{ verified: boolean; name?: string }>('/auth/verify-fayda', {
      method: 'POST',
      body: JSON.stringify({ fayda }),
    }),

  /**
   * Request password reset
   */
  forgotPin: (phoneNumber: string) =>
    request<{ success: boolean; message: string }>('/auth/forgot-pin', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    }),

  /**
   * Reset PIN with OTP
   */
  resetPin: (phoneNumber: string, otp: string, newPin: string) =>
    request<{ success: boolean }>('/auth/reset-pin', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp, newPin }),
    }),

  /**
   * Refresh access token
   */
  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  /**
   * Get current user
   */
  getCurrentUser: () =>
    request<any>('/auth/me', {
      method: 'GET',
    }),

  /**
   * Logout
   */
  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),
};

/**
 * User API Endpoints
 */
export const userAPI = {
  /**
   * Get user profile
   */
  getProfile: (userId: string) =>
    request<any>(`/users/${userId}`, {
      method: 'GET',
    }),

  /**
   * Update user profile
   */
  updateProfile: (userId: string, data: any) =>
    request<any>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

/**
 * Equb API Endpoints
 */
export const equbAPI = {
  /**
   * Get all equbs
   */
  getAll: (params?: { page?: number; limit?: number }) =>
    request<any>('/equbs', {
      method: 'GET',
      params,
    }),

  /**
   * Get equb by ID
   */
  getById: (id: string) =>
    request<any>(`/equbs/${id}`, {
      method: 'GET',
    }),

  /**
   * Create new equb
   */
  create: (data: any) =>
    request<any>('/equbs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Join equb
   */
  join: (equbId: string) =>
    request<any>(`/equbs/${equbId}/join`, {
      method: 'POST',
    }),
};

/**
 * Payment API Endpoints
 */
export const paymentService = {
  /**
   * Initiate payment
   */
  initiate: (data: any) =>
    request<any>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Verify payment
   */
  verify: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/verify`, {
      method: 'POST',
    }),

  /**
   * Get payment status
   */
  getStatus: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/status`, {
      method: 'GET',
    }),
};

/**
 * Health Check
 */
export const healthAPI = {
  /**
   * Check if backend is running
   */
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
