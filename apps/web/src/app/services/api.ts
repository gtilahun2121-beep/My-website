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
 *
 * Naming convention:
 *   All payloads sent to the backend use snake_case to match the backend DTOs.
 *   All data received from the backend is in snake_case.
 *   The UI layer (components/context) maps to camelCase as needed.
 */

import type {
  RegisterRequest,
  LoginRequest,
  AuthTokenResponse,
  RefreshTokenRequest,
  CheckoutRequest,
  BidRequest,
  GetPendingPaymentsParams,
  CreateProposalRequest,
  CastVoteRequest,
  FileTicketRequest,
  FlagCrbRequest,
  EqubGroup,
  EqubCreationRequest,
  Wallet,
  WalletTransaction,
} from '@qalnet/shared-types';

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
    const response = await fetch(url, { ...init, headers, credentials: 'include' });

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

/**
 * Pads a short PIN to satisfy the backend password requirements:
 *   - Minimum 8 characters
 *   - Must contain at least one letter and one number
 *
 * "1234" → "1234QN1234!"  (12 chars, letters + numbers ✓)
 *
 * If the input is already a compliant password (≥8 chars with a letter),
 * it is passed through unchanged.
 */
export function padPin(pin: string): string {
  if (pin.length >= 8 && /[A-Za-z]/.test(pin)) return pin;
  return `${pin}QN${pin}!`;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const authAPI = {
  /**
   * POST /api/v1/auth/register
   * Creates a new participant account.
   *
   * The UI collects camelCase fields; this function maps them to the
   * snake_case backend RegisterDto format before sending.
   * PIN/password is padded with padPin() before sending.
   */
  signup: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;   // 4-digit PIN from UI — will be padded
    fayda: string;      // 16-digit Fayda national ID number
    telegramHandle?: string;
  }) => {
    const payload: RegisterRequest = {
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phoneNumber,
      password: padPin(data.password),
      fayda_id: data.fayda,
      telegram_handle: data.telegramHandle,
    };
    return request<AuthTokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/auth/check-availability
   * Pre-checks whether an email and/or phone is already registered.
   * Lets the signup form tell the user before they submit.
   */
  checkAvailability: (data: { email?: string; phoneNumber?: string }) =>
    request<{ available: boolean; email_taken: boolean; phone_taken: boolean }>(
      '/auth/check-availability',
      {
        method: 'POST',
        body: JSON.stringify({
          email: data.email || undefined,
          phone: data.phoneNumber || undefined,
        }),
      },
    ),

  /**
   * POST /api/v1/auth/login
   * Authenticates with phone/email + PIN (padded identically to signup).
   *
   * Backend accepts `identifier` = phone number OR email address.
   */
  signin: (identifier: string, pin: string) => {
    const payload: LoginRequest = {
      identifier,
      password: padPin(pin),
    };
    return request<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/auth/refresh
   * Rotates both access and refresh tokens.
   * Browser clients: token sent automatically via HttpOnly cookie.
   * Mobile/USSD clients: pass refresh_token in body.
   */
  refreshToken: (refreshToken?: string) => {
    const payload: RefreshTokenRequest = refreshToken
      ? { refresh_token: refreshToken }
      : {};
    return request<AuthTokenResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token. Requires a valid access token in the header.
   */
  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // ── OTP / PIN reset — real backend endpoints ─────────────────────────────

  /**
   * POST /api/v1/auth/verify-otp
   * Verifies the OTP sent to the user's phone.
   */
  verifyOTP: (phoneNumber: string, otp: string) =>
    request<{ verified: boolean }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneNumber, otp }),
    }),

  /**
   * POST /api/v1/auth/send-otp
   * Sends an OTP to a phone for signup (Fayda) verification — works before
   * the account exists (unlike forgot-pin).
   */
  sendOtp: (phoneNumber: string) =>
    request<{ success: boolean; message: string; dev_otp?: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneNumber }),
    }),

  /**
   * POST /api/v1/auth/verify-fayda
   * Verifies a Fayda national ID number.
   */
  verifyFayda: (fayda_id: string) =>
    request<{ verified: boolean; name?: string }>('/auth/verify-fayda', {
      method: 'POST',
      body: JSON.stringify({ fayda_id }),
    }),

  /**
   * POST /api/v1/auth/forgot-pin
   * Initiates a PIN reset flow — sends OTP to phone.
   */
  forgotPin: (phoneNumber: string) =>
    request<{ success: boolean; message: string; dev_otp?: string }>('/auth/forgot-pin', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneNumber }),
    }),

  /**
   * POST /api/v1/auth/reset-pin
   * Resets PIN using OTP verification.
   */
  resetPin: (phoneNumber: string, otp: string, newPin: string) =>
    request<{ success: boolean }>('/auth/reset-pin', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneNumber, otp, new_pin: padPin(newPin) }),
    }),
};

// ---------------------------------------------------------------------------
// Payments API
// ---------------------------------------------------------------------------

export const paymentsAPI = {
  /**
   * GET /api/v1/payments/pending
   * Returns outstanding payment objects for the active round.
   * Requires: JWT access token (Bearer).
   */
  getPending: (params: GetPendingPaymentsParams) =>
    request<any[]>('/payments/pending', {
      method: 'GET',
      params: { equb_id: params.equb_id, round: params.round },
    }),

  /**
   * POST /api/v1/payments/checkout
   * Initiates a wallet deduction or external payment checkout.
   * Requires: JWT access token (Bearer).
   *
   * NOTE: The old frontend called /payments/initiate — that endpoint does NOT exist.
   * The correct endpoint is /payments/checkout.
   */
  checkout: (data: CheckoutRequest) =>
    request<any>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * POST /api/v1/equbs/:id/bid
   * Submits a discount bid to win early payout in the current round.
   * Requires: JWT access token (Bearer) with role 'participant' or 'host'.
   *
   * Note: equb_id is passed in the URL; bid_amount in the body.
   */
  submitBid: (equbId: string, bid_amount: number) => {
    const payload: Omit<BidRequest, 'equb_id'> = { bid_amount };
    return request<any>(`/equbs/${equbId}/bid`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // NOTE: /payments/:id/verify and /payments/:id/status do NOT exist in the backend.
  // Payment status updates are handled via the webhook endpoint.
  // Remove any UI calls to those non-existent endpoints.
};

// ---------------------------------------------------------------------------
// Social API
// ---------------------------------------------------------------------------

export const socialAPI = {
  /**
   * POST /api/v1/equbs/:id/proposals
   * Submits a social fund spending proposal.
   * Requires: JWT access token (Bearer).
   */
  createProposal: (equbId: string, data: CreateProposalRequest) =>
    request<any>(`/equbs/${equbId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * GET /api/v1/equbs/:id/proposals
   * Lists social fund proposals for an Equb group.
   * Requires: JWT access token (Bearer).
   */
  listProposals: (equbId: string, status?: string) =>
    request<any[]>(`/equbs/${equbId}/proposals`, {
      method: 'GET',
      params: status ? { status } : undefined,
    }),

  /**
   * POST /api/v1/proposals/:id/vote
   * Casts a yes/no vote on a social fund proposal.
   * Requires: JWT access token (Bearer).
   */
  castVote: (proposalId: string, data: CastVoteRequest) =>
    request<any>(`/proposals/${proposalId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * PATCH /api/v1/proposals/:id/execute
   * Executes an approved proposal — disburses funds. Admin only.
   * Requires: JWT access token (Bearer) with role 'admin'.
   */
  executeProposal: (proposalId: string) =>
    request<any>(`/proposals/${proposalId}/execute`, { method: 'PATCH' }),

  /**
   * POST /api/v1/tickets
   * Files a payment dispute / reconciliation ticket.
   * Requires: JWT access token (Bearer).
   */
  fileTicket: (data: FileTicketRequest) =>
    request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * GET /api/v1/tickets/mine
   * Lists the current user's reconciliation tickets.
   * Requires: JWT access token (Bearer).
   */
  listMyTickets: () =>
    request<any[]>('/tickets/mine', { method: 'GET' }),

  /**
   * POST /api/v1/admin/crb/flag
   * Flags a defaulting member on CRB. Admin only.
   * Requires: JWT access token (Bearer) with role 'admin'.
   */
  flagCrb: (data: FlagCrbRequest) =>
    request<any>('/admin/crb/flag', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * PATCH /api/v1/admin/crb/:userId/release
   * Releases a CRB flag from a user. Admin only.
   * Requires: JWT access token (Bearer) with role 'admin'.
   */
  releaseCrb: (userId: string) =>
    request<any>(`/admin/crb/${userId}/release`, { method: 'PATCH' }),
};

// ---------------------------------------------------------------------------
// User API
// ---------------------------------------------------------------------------

export const userAPI = {
  getProfile: () =>
    request<any>(`/users/me`, { method: 'GET' }),

  updateProfile: (data: any) =>
    request<any>(`/users/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ---------------------------------------------------------------------------
// Admin API (role: admin only)
// ---------------------------------------------------------------------------

export interface AdminCustomer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  telegram_handle: string | null;
  profile_photo: string | null;
  role: 'participant' | 'host' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface AdminCustomerSummary {
  total: number;
  active: number;
  hosts: number;
  new_this_month: number;
}

export interface AdminCustomerListResponse {
  items: AdminCustomer[];
  total: number;
  page: number;
  limit: number;
  summary: AdminCustomerSummary;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'participant' | 'host' | 'admin';
  status?: 'active' | 'inactive';
}

export interface AdminStatsKpis {
  total_users: number;
  active_users: number;
  hosts: number;
  new_users_this_month: number;
  total_equbs: number;
  active_equbs: number;
  total_memberships: number;
  total_wallet_balance: number;
  successful_payments: number;
  pending_payments: number;
  failed_transactions: number;
  pending_withdrawals: number;
  total_payout_volume: number;
  operational_equbs: number;
}

export interface AdminTrendPoint {
  date: string;
  count: number;
}

export interface AdminRecentTransaction {
  id: string;
  amount: string;
  status: string;
  round_number: number;
  paid_at: string | null;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  equb_name: string;
}

export interface AdminTopEqub {
  id: string;
  name: string;
  total_amount: string;
  contribution_amount: string;
  current_round: number;
  total_rounds: number;
  status: string;
  created_at: string;
  member_count: number;
}

export interface AdminStats {
  kpis: AdminStatsKpis;
  trend: AdminTrendPoint[];
  recent_transactions: AdminRecentTransaction[];
  top_equbs: AdminTopEqub[];
}

export const adminAPI = {
  /**
   * GET /api/v1/admin/stats
   * Dashboard aggregates — KPIs, 30-day registration trend, recent
   * transactions and top equbs (admin only).
   */
  getStats: () => request<AdminStats>('/admin/stats', { method: 'GET' }),

  /**
   * GET /api/v1/admin/users
   * Lists registered customers (admin only). Requires a JWT whose role is 'admin'.
   */
  listUsers: (params: ListUsersParams = {}) =>
    request<AdminCustomerListResponse>('/admin/users', {
      method: 'GET',
      params,
    }),

  /**
   * GET /api/v1/admin/equb-requests
   * Lists pending Equb creation requests submitted by members (admin only).
   */
  listEqubRequests: () =>
    request<EqubCreationRequest[]>('/admin/equb-requests', { method: 'GET' }),

  /**
   * POST /api/v1/admin/equb-requests/:id/approve
   * Approves a member's creation request — creates the Equb (admin hosts it)
   * and auto-approves the requesting member. Admin only.
   */
  approveEqubRequest: (requestId: string) =>
    request<any>(`/admin/equb-requests/${requestId}/approve`, { method: 'POST' }),

  /**
   * POST /api/v1/admin/equb-requests/:id/reject
   * Rejects a member's creation request with an optional note. Admin only.
   */
  rejectEqubRequest: (requestId: string, admin_notes?: string) =>
    request<any>(`/admin/equb-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ admin_notes: admin_notes ?? '' }),
    }),

  /**
   * GET /api/v1/admin/memberships/pending
   * Lists pending join requests from members awaiting approval. Admin only.
   */
  listPendingMemberships: () =>
    request<any[]>('/admin/memberships/pending', { method: 'GET' }),

  /**
   * POST /api/v1/admin/memberships/:id/approve
   * Approves a member's join request. Admin only.
   */
  approveMembership: (membershipId: string) =>
    request<any>(`/admin/memberships/${membershipId}/approve`, { method: 'POST' }),

  /**
   * POST /api/v1/admin/memberships/:id/reject
   * Rejects a member's join request. Admin only.
   */
  rejectMembership: (membershipId: string) =>
    request<any>(`/admin/memberships/${membershipId}/reject`, { method: 'POST' }),

  /**
   * POST /api/v1/admin/users/:id/reset-pin
   * Admin resets a user's PIN and clears any login lockout
   * (including permanently blocked accounts). Admin only.
   */
  resetUserPin: (userId: string, newPin: string) =>
    request<any>(`/admin/users/${userId}/reset-pin`, {
      method: 'POST',
      body: JSON.stringify({ new_pin: padPin(newPin) }),
    }),

  /**
   * PATCH /api/v1/admin/users/:id/role
   * Grant or revoke a user's role — the database owner promotes a
   * registered member to website admin (admin console access) or
   * demotes them. Admin only.
   */
  updateUserRole: (userId: string, role: 'participant' | 'host' | 'admin') =>
    request<any>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
};

// ---------------------------------------------------------------------------
// Equb API
// ---------------------------------------------------------------------------

export const equbAPI = {
  getAll: (params?: { page?: number; limit?: number }) =>
    request<EqubGroup[]>('/equbs', { method: 'GET', params }),

  getById: (id: string) => request<EqubGroup>(`/equbs/${id}`, { method: 'GET' }),

  getMine: () => request<EqubGroup[]>('/equbs/mine', { method: 'GET' }),

  /**
   * POST /api/v1/equbs
   * Direct creation — ADMIN ONLY (enforced by RolesGuard on the backend).
   */
  create: (data: any) =>
    request<any>('/equbs', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * POST /api/v1/equbs/:id/join
   * Requests to join an Equb. For non-admin members the membership stays
   * 'pending' until an admin approves it.
   */
  join: (equbId: string) =>
    request<any>(`/equbs/${equbId}/join`, { method: 'POST' }),

  /**
   * POST /api/v1/equbs/requests
   * A member asks the admin to create the Equb they want.
   */
  requestCreate: (data: {
    name: string;
    description?: string;
    contribution_amount: number;
    total_rounds: number;
    cycle_days: number;
  }) =>
    request<EqubCreationRequest>('/equbs/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * GET /api/v1/equbs/requests/mine
   * Lists the current member's Equb creation requests and their status.
   */
  getMyRequests: () =>
    request<EqubCreationRequest[]>('/equbs/requests/mine', { method: 'GET' }),
};

// ---------------------------------------------------------------------------
// Wallet API
// ---------------------------------------------------------------------------

export const walletAPI = {
  getBalance: () => request<Wallet>('/wallets/me', { method: 'GET' }),
  getTransactions: () =>
    request<WalletTransaction[]>('/wallets/me/transactions', { method: 'GET' }),
  deposit: (amount: number) =>
    request<any>('/wallets/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  withdraw: (amount: number, method?: string, phone?: string) =>
    request<any>('/wallets/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, method, phone }),
    }),
};

// ---------------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------------

export const notificationsAPI = {
  getNotifications: () => request<any[]>('/notifications', { method: 'GET' }),
  markAsRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
};

// ---------------------------------------------------------------------------
// Health API
// ---------------------------------------------------------------------------

export const healthAPI = {
  check: () =>
    request<{ status: string; timestamp: string }>('/health', {
      method: 'GET',
    }),
};

// ---------------------------------------------------------------------------
// Default export (for backward compatibility)
// ---------------------------------------------------------------------------

export default {
  authAPI,
  paymentsAPI,
  socialAPI,
  userAPI,
  adminAPI,
  equbAPI,
  walletAPI,
  notificationsAPI,
  healthAPI,
  request,
  padPin,
  APIError,
};
