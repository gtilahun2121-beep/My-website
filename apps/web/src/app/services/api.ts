/**
 * api.ts
 * Centralised HTTP client for all backend API calls.
 *
 * Base URL:  NEXT_PUBLIC_API_BASE_URL  (default: http://localhost:4000)
 * Version:   NEXT_PUBLIC_API_VERSION   (default: v1)
 *
 * PIN padding:
 *   The frontend collects a 6-digit PIN as the user's credential.
 *   The backend RegisterDto requires min 8 chars + letter + number.
 *   We pad short PINs with a deterministic suffix before sending so the
 *   DTO validates, Argon2id hashes it, and the same padding on login
 *   produces an identical hash.  e.g. "123456" → "123456QN123456!"
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
  LoginResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
  TwoFactorDisableResponse,
  TwoFactorStatusResponse,
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
  Proposal,
  VoteTally,
  ReconciliationTicket,
  Notification,
  UserProfileData,
  LotteryDrawResponse,
  LotteryDrawListResponse,
  UserLotteryCurrentResponse,
  UserLotteryHistoryResponse,
  SubmitBidResponse,
  RoundBidListResponse,
  AuctionResolutionResponse,
} from '@qalnet/shared-types';

// In the browser we use a relative base so requests go through the Next.js
// proxy rewrite (next.config.ts → rewrites → /api/* → backend). This
// eliminates CORS entirely. On the server (SSR) we need the absolute URL.
const API_BASE_URL =
  typeof window !== 'undefined'
    ? '' // relative — browser hits the Next.js proxy at /api/*
    : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000');
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export interface ApiErrorData {
  message?: string;
  error?: string;
  statusCode?: number;
}

export class APIError extends Error {
  constructor(
    public status: number,
    public data?: ApiErrorData,
    message?: string,
  ) {
    super(message || `API Error: ${status}`);
    this.name = 'APIError';
  }
}

// ---------------------------------------------------------------------------
// Token refresh — silent 401 recovery
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to rotate the access token using the stored refresh token
 * (falls back to the HttpOnly cookie). Deduplicated so concurrent 401s
 * trigger a single refresh round-trip. Returns true when a new access
 * token was persisted.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/${API_VERSION}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthTokenResponse;
      if (!data.access_token) return false;
      localStorage.setItem('authToken', data.access_token);
      if (data.refresh_token) localStorage.setItem('refreshToken', data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

interface RequestOptions extends RequestInit {
  params?: object;
}

async function request<T = unknown>(
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

  // One silent retry per request after a token refresh.
  let attempts = 0;

  for (;;) {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const headers = new Headers(init.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
      response = await fetch(url, { ...init, headers, credentials: 'include' });
    } catch (error) {
      throw new Error(
        `API Request Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Only try the silent token-refresh retry on AUTHENTICATED requests
    // (a Bearer token was attached). Public endpoints like /auth/login return
    // 401 for bad credentials — the real message (e.g. "Invalid PIN" or
    // "You are locked for 10 minutes") must reach the user unchanged instead
    // of being replaced by the generic "Session expired" text.
    if (response.status === 401 && attempts === 0 && token) {
      attempts += 1;
      const refreshed = await refreshAccessToken();
      if (refreshed) continue;
      // Refresh failed — the session is gone. Clear the tokens so the next
      // page load lands on sign-in instead of throwing unhelpful 401s.
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
      }
      throw new APIError(401, undefined, 'Session expired. Please sign in again.');
    }

    const contentType = response.headers.get('content-type');
    let data: unknown;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorData =
        typeof data === 'object' && data !== null ? (data as ApiErrorData) : undefined;
      throw new APIError(
        response.status,
        errorData,
        errorData?.message || `HTTP ${response.status}`,
      );
    }

    return data as T;
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
 * "123456" → "123456QN123456!"  (15 chars, letters + numbers ✓)
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
    password: string;   // 6-digit PIN from UI — will be padded
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
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ── Two-factor authentication (TOTP) ─────────────────────────────────────

  /**
   * POST /api/v1/auth/2fa/setup
   * Generates a TOTP secret + otpauth URL for the authenticator app QR code.
   * Requires an authenticated session.
   */
  setup2FA: () =>
    request<TwoFactorSetupResponse>('/auth/2fa/setup', { method: 'POST' }),

  /**
   * POST /api/v1/auth/2fa/verify
   * Verifies the setup code and enables 2FA, returning one-time backup codes.
   */
  verify2FASetup: (code: string) =>
    request<TwoFactorVerifyResponse>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  /**
   * POST /api/v1/auth/2fa/disable
   * Disables 2FA after verifying a current code.
   */
  disable2FA: (code: string) =>
    request<TwoFactorDisableResponse>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  /**
   * GET /api/v1/auth/2fa/status
   * Current 2FA status for the signed-in user.
   */
  get2FAStatus: () =>
    request<TwoFactorStatusResponse>('/auth/2fa/status', { method: 'GET' }),

  /**
   * POST /api/v1/auth/verify-2fa
   * Completes login with a TOTP/backup code after /auth/login returned
   * two_factor_required. Returns the real access + refresh tokens.
   */
  verify2FALogin: (mfa_token: string, code: string) =>
    request<AuthTokenResponse>('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ mfa_token, code }),
    }),

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
    request<unknown[]>('/payments/pending', {
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
    request<unknown>('/payments/checkout', {
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
    return request<SubmitBidResponse>(`/equbs/${equbId}/bid`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * GET /api/v1/equbs/:id/bids?round=N
   * Lists the auction leaderboard for a round, highest bid first.
   */
  listRoundBids: (equbId: string, round: number) =>
    request<RoundBidListResponse>(`/equbs/${equbId}/bids`, {
      method: 'GET',
      params: { round },
    }),

  /**
   * POST /api/v1/equbs/:id/auction/resolve
   * Resolves the current round auction — the highest bidder wins (host/admin).
   */
  resolveAuction: (equbId: string) =>
    request<AuctionResolutionResponse>(`/equbs/${equbId}/auction/resolve`, {
      method: 'POST',
    }),

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
    request<Proposal>(`/equbs/${equbId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * GET /api/v1/equbs/:id/proposals
   * Lists social fund proposals for an Equb group.
   * Requires: JWT access token (Bearer).
   */
  listProposals: (equbId: string, status?: string) =>
    request<Proposal[]>(`/equbs/${equbId}/proposals`, {
      method: 'GET',
      params: status ? { status } : undefined,
    }),

  /**
   * POST /api/v1/proposals/:id/vote
   * Casts a yes/no vote on a social fund proposal.
   * Requires: JWT access token (Bearer).
   */
  castVote: (proposalId: string, data: CastVoteRequest) =>
    request<VoteTally>(`/proposals/${proposalId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * PATCH /api/v1/proposals/:id/execute
   * Executes an approved proposal — disburses funds. Admin only.
   * Requires: JWT access token (Bearer) with role 'admin'.
   */
  executeProposal: (proposalId: string) =>
    request<unknown>(`/proposals/${proposalId}/execute`, { method: 'PATCH' }),

  /**
   * POST /api/v1/tickets
   * Files a payment dispute / reconciliation ticket.
   * Requires: JWT access token (Bearer).
   */
  fileTicket: (data: FileTicketRequest) =>
    request<ReconciliationTicket>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * GET /api/v1/tickets/mine
   * Lists the current user's reconciliation tickets.
   * Requires: JWT access token (Bearer).
   */
  listMyTickets: () =>
    request<ReconciliationTicket[]>('/tickets/mine', { method: 'GET' }),

  /**
   * POST /api/v1/admin/crb/flag
   * Flags a defaulting member on CRB. Admin only.
   * Requires: JWT access token (Bearer) with role 'admin'.
   */
  flagCrb: (data: FlagCrbRequest) =>
    request<unknown>('/admin/crb/flag', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * PATCH /api/v1/admin/crb/:userId/release
   * Releases a CRB flag from a user. Admin only.
   * Requires: JWT access token (Bearer) with role 'admin'.
   */
  releaseCrb: (userId: string) =>
    request<unknown>(`/admin/crb/${userId}/release`, { method: 'PATCH' }),
};

// ---------------------------------------------------------------------------
// User API
// ---------------------------------------------------------------------------

export const userAPI = {
  getProfile: () =>
    request<UserProfileData>(`/users/me`, { method: 'GET' }),

  updateProfile: (data: Partial<UserProfileData>) =>
    request<UserProfileData>(`/users/me`, {
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
  verification_status: 'pending' | 'verified' | 'rejected';
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
  kyc?: 'pending' | 'verified' | 'rejected';
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
  transactions_30d: number;
  transactions_prev_30d: number;
  db_size_bytes: number;
}

export interface AdminTrendPoint {
  date: string;
  count: number;
  registrations?: number;
  payments?: number;
  equbs?: number;
  joins?: number;
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

export interface AdminFinanceOverview {
  total_wallet_balance: number;
  wallet_count: number;
  transaction_volume: number;
  successful_payments: number;
  pending_payments: number;
  pending_volume: number;
  failed_payments: number;
  fees_collected: number;
  admin_fees_collected: number;
  payout_volume: number;
  completed_payouts: number;
  pending_withdrawals: number;
  pending_withdrawal_volume: number;
}

export interface AdminFinanceTransaction {
  id: string;
  amount: string;
  fee_deducted: string;
  host_commission_deducted: string;
  round_number: number;
  status: string;
  transaction_reference: string | null;
  paid_at: string | null;
  created_at: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  equb_name: string;
}

export interface AdminFinancePayout {
  id: string;
  round_number: number;
  total_pot_amount: string;
  status: string;
  created_at: string;
  winner_first_name: string;
  winner_last_name: string;
  winner_phone: string;
  equb_name: string;
}

export interface AdminFinanceTransactionListResponse {
  items: AdminFinanceTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminFinancePayoutListResponse {
  items: AdminFinancePayout[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminWallet {
  id: string;
  user_id: string;
  balance: string;
  currency: string;
  updated_at: string | null;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  user_email: string;
}

export interface AdminWalletListResponse {
  items: AdminWallet[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminEqub {
  id: string;
  host_id: string;
  name: string;
  description: string | null;
  total_amount: string;
  contribution_amount: string;
  cycle_days: number;
  total_rounds: number;
  current_round: number;
  status: string;
  social_fund_balance: string;
  created_at: string;
  updated_at: string;
  host_first_name: string;
  host_last_name: string;
  host_phone: string;
  member_count: number;
}

export interface AdminEqubListResponse {
  items: AdminEqub[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminSystemLog {
  id: string;
  table_name: string;
  action: string;
  row_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: string;
}

export interface AdminSystemLogListResponse {
  items: AdminSystemLog[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminFinanceTransactionParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  start?: string;
  end?: string;
}

export interface PendingMembership {
  id: string;
  user_id: string;
  equb_id: string;
  status: string;
  joined_at: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  user_email: string;
  equb_name: string;
  equb_contribution: number;
  equb_total_rounds: number;
}

export const adminAPI = {
  /**
   * GET /api/v1/admin/stats
   * Dashboard aggregates — KPIs, activity trend, recent transactions
   * and top equbs (admin only). `range` selects a preset trend window;
   * `start`/`end` (YYYY-MM-DD) select a custom calendar range.
   */
  getStats: (params?: { range?: '7d' | '30d' | '90d'; start?: string; end?: string }) =>
    request<AdminStats>('/admin/stats', {
      method: 'GET',
      params:
        params && (params.range || params.start || params.end) ? params : undefined,
    }),

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
    request<unknown>(`/admin/equb-requests/${requestId}/approve`, { method: 'POST' }),

  /**
   * POST /api/v1/admin/equb-requests/:id/reject
   * Rejects a member's creation request with an optional note. Admin only.
   */
  rejectEqubRequest: (requestId: string, admin_notes?: string) =>
    request<unknown>(`/admin/equb-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ admin_notes: admin_notes ?? '' }),
    }),

  /**
   * GET /api/v1/admin/memberships/pending
   * Lists pending join requests from members awaiting approval. Admin only.
   */
  listPendingMemberships: () =>
    request<PendingMembership[]>('/admin/memberships/pending', { method: 'GET' }),

  /**
   * POST /api/v1/admin/memberships/:id/approve
   * Approves a member's join request. Admin only.
   */
  approveMembership: (membershipId: string) =>
    request<unknown>(`/admin/memberships/${membershipId}/approve`, { method: 'POST' }),

  /**
   * POST /api/v1/admin/memberships/:id/reject
   * Rejects a member's join request. Admin only.
   */
  rejectMembership: (membershipId: string) =>
    request<unknown>(`/admin/memberships/${membershipId}/reject`, { method: 'POST' }),

  /**
   * POST /api/v1/admin/users/:id/reset-pin
   * Admin resets a user's PIN and clears any login lockout
   * (including permanently blocked accounts). Admin only.
   */
  resetUserPin: (userId: string, newPin: string) =>
    request<unknown>(`/admin/users/${userId}/reset-pin`, {
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
    request<unknown>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  /**
   * PATCH /api/v1/admin/users/:id/kyc
   * Verifies or rejects a member identity (KYC) submission. Admin only.
   */
  updateKycStatus: (userId: string, status: 'verified' | 'rejected') =>
    request<unknown>(`/admin/users/${userId}/kyc`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  /**
   * GET /api/v1/admin/finance/overview
   * Finance KPIs — wallet balance, transaction volume, fees, payout and
   * withdrawal aggregates (admin only).
   */
  getFinanceOverview: () =>
    request<AdminFinanceOverview>('/admin/finance/overview', { method: 'GET' }),

  /**
   * GET /api/v1/admin/finance/transactions
   * Lists payments with pagination, search and status/date filters (admin only).
   */
  listFinanceTransactions: (params: AdminFinanceTransactionParams = {}) =>
    request<AdminFinanceTransactionListResponse>('/admin/finance/transactions', {
      method: 'GET',
      params:
        params && (params.page || params.limit || params.status || params.search || params.start || params.end)
          ? params
          : undefined,
    }),

  /**
   * GET /api/v1/admin/finance/payouts
   * Lists rotation payouts with pagination and status filter (admin only).
   */
  listFinancePayouts: (params: { page?: number; limit?: number; status?: string } = {}) =>
    request<AdminFinancePayoutListResponse>('/admin/finance/payouts', {
      method: 'GET',
      params: params && (params.page || params.limit || params.status) ? params : undefined,
    }),

  /**
   * GET /api/v1/admin/wallets
   * Lists member wallets (paged, searchable). Admin only.
   */
  listWallets: (params: { page?: number; limit?: number; search?: string } = {}) =>
    request<AdminWalletListResponse>('/admin/wallets', {
      method: 'GET',
      params: params && (params.page || params.limit || params.search) ? params : undefined,
    }),

  /**
   * GET /api/v1/admin/equbs
   * Lists all Equb groups (paged, searchable). Admin only.
   */
  listAdminEqubs: (params: { page?: number; limit?: number; search?: string } = {}) =>
    request<AdminEqubListResponse>('/admin/equbs', {
      method: 'GET',
      params: params && (params.page || params.limit || params.search) ? params : undefined,
    }),

  /**
   * GET /api/v1/admin/system-logs
   * Lists security/audit log entries (paged, filterable). Admin only.
   */
  listSystemLogs: (params: { page?: number; limit?: number; table?: string; action?: string } = {}) =>
    request<AdminSystemLogListResponse>('/admin/system-logs', {
      method: 'GET',
      params:
        params && (params.page || params.limit || params.table || params.action)
          ? params
          : undefined,
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
   * GET /api/v1/equbs/presets
   * Returns featured preset equb templates for quick creation
   */
  getPresets: () =>
    request<any[]>('/equbs/presets', { method: 'GET' }),

  /**
   * POST /api/v1/equbs
   * Direct creation — ADMIN ONLY (enforced by RolesGuard on the backend).
   */
  create: (data: Partial<EqubCreationRequest>) =>
    request<EqubGroup>('/equbs', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * POST /api/v1/equbs/:id/join
   * Requests to join an Equb. For non-admin members the membership stays
   * 'pending' until an admin approves it.
   */
  join: (equbId: string) =>
    request<{ pending?: boolean; alreadyRequested?: boolean; alreadyMember?: boolean }>(`/equbs/${equbId}/join`, { method: 'POST' }),

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

  /**
   * POST /api/v1/equbs/:id/activate
   * Starts the first round of an 'open' Equb (status → 'active', round → 1).
   * HOST/ADMIN ONLY (enforced by RolesGuard on the backend).
   */
  activateEqub: (id: string) =>
    request<EqubGroup>(`/equbs/${id}/activate`, { method: 'POST' }),

  /**
   * GET /api/v1/equbs/:id/draws
   * Lists the lottery draw history for an Equb, newest round first.
   */
  getDraws: (id: string) =>
    request<LotteryDrawListResponse>(`/equbs/${id}/draws`, { method: 'GET' }),

  /**
   * POST /api/v1/equbs/:id/draws
   * Runs the lottery draw for the current round — HOST/ADMIN ONLY.
   * Returns the winner + candidates so the wheel can animate to the winner.
   */
  runDraw: (id: string) =>
    request<LotteryDrawResponse>(`/equbs/${id}/draws`, { method: 'POST' }),

  /**
   * GET /api/v1/equbs/:id/lottery/current
   * User-facing (read-only) view of the active lottery cycle, the current
   * member's eligibility (computed backend-side), and the latest public winner.
   * Exposes only public fields (displayName) — never phone/email/wallet ids.
   */
  getLotteryCurrent: (id: string) =>
    request<UserLotteryCurrentResponse>(`/equbs/${id}/lottery/current`, {
      method: 'GET',
    }),

  /**
   * GET /api/v1/equbs/:id/lottery/history
   * User-facing (read-only) paginated list of past lottery winners.
   * Exposes only public winner display names.
   */
  getLotteryHistory: (id: string, params?: { page?: number; limit?: number }) =>
    request<UserLotteryHistoryResponse>(`/equbs/${id}/lottery/history`, {
      method: 'GET',
      params,
    }),
};

// ---------------------------------------------------------------------------
// Wallet API
// ---------------------------------------------------------------------------

export const walletAPI = {
  getBalance: () => request<Wallet>('/wallets/me', { method: 'GET' }),
  getTransactions: () =>
    request<WalletTransaction[]>('/wallets/me/transactions', { method: 'GET' }),
  deposit: (amount: number, pin: string) =>
    request<{ balance: number }>('/wallets/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, pin: padPin(pin) }),
    }),
  withdraw: (amount: number, method?: string, phone?: string, pin?: string) =>
    request<{ balance: number }>('/wallets/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, method, phone, pin: pin ? padPin(pin) : undefined }),
    }),
  verifyPin: (pin: string) =>
    request<{ verified: boolean }>('/wallets/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: padPin(pin) }),
    }),
};

// ---------------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------------

export const notificationsAPI = {
  getNotifications: () => request<Notification[]>('/notifications', { method: 'GET' }),
  markAsRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
  deleteNotification: (id: string) =>
    request<Notification>(`/notifications/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Daily-Cycle API
// ---------------------------------------------------------------------------

export interface DailyCycleState {
  equb_id: string;
  name: string;
  contribution_amount: number;
  current_round: number;
  total_rounds: number;
  payment_cutoff_time: string;
  late_penalty_rate: number;
  cycle_date: string;
  cycle_status: 'open' | 'closed' | 'drawn';
  payment_window_open: boolean;
}

export interface DailyCycleRunResult {
  equb_id: string;
  success: boolean;
  cycle_date?: string;
  penalties_applied: number;
  draw?: unknown;
  message: string;
}

export const dailyCycleAPI = {
  /**
   * GET /api/v1/daily-cycles/:equbId/state
   * Current daily window / cycle state for a daily equb (authenticated).
   */
  getState: (equbId: string) =>
    request<DailyCycleState>(`/daily-cycles/${equbId}/state`, { method: 'GET' }),

  /**
   * POST /api/v1/daily-cycles/:equbId/run
   * Force-runs this equb's daily cutoff (close window → penalties → draw).
   * HOST/ADMIN ONLY.
   */
  runEqub: (equbId: string) =>
    request<DailyCycleRunResult>(`/daily-cycles/${equbId}/run`, { method: 'POST' }),

  /**
   * POST /api/v1/daily-cycles/run-due
   * Processes every daily equb whose cutoff has passed. ADMIN ONLY.
   */
  runDue: (force = false) =>
    request<{ processed: number; results: unknown[] }>(`/daily-cycles/run-due`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
};

// ---------------------------------------------------------------------------
// Weekly-Cycle API
// ---------------------------------------------------------------------------

export interface WeeklyCycleState {
  equb_id: string;
  name: string;
  contribution_amount: number;
  current_round: number;
  total_rounds: number;
  payment_cutoff_time: string;
  payment_cutoff_weekday: number;
  late_penalty_rate: number;
  cycle_date: string;
  cycle_status: 'open' | 'closed' | 'drawn';
  payment_window_open: boolean;
}

export interface WeeklyCycleRunResult {
  equb_id: string;
  success: boolean;
  cycle_date?: string;
  penalties_applied: number;
  draw?: unknown;
  message: string;
}

export const weeklyCycleAPI = {
  /**
   * GET /api/v1/weekly-cycles/:equbId/state
   * Current weekly window / cycle state for a weekly equb (authenticated).
   */
  getState: (equbId: string) =>
    request<WeeklyCycleState>(`/weekly-cycles/${equbId}/state`, { method: 'GET' }),

  /**
   * POST /api/v1/weekly-cycles/:equbId/run
   * Force-runs this equb's weekly cutoff (close window → penalties → draw).
   * HOST/ADMIN ONLY.
   */
  runEqub: (equbId: string) =>
    request<WeeklyCycleRunResult>(`/weekly-cycles/${equbId}/run`, { method: 'POST' }),

  /**
   * POST /api/v1/weekly-cycles/run-due
   * Processes every weekly equb whose cutoff has passed. ADMIN ONLY.
   */
  runDue: (force = false) =>
    request<{ processed: number; results: unknown[] }>(`/weekly-cycles/run-due`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
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

const apiClient = {
  authAPI,
  paymentsAPI,
  socialAPI,
  userAPI,
  adminAPI,
  equbAPI,
  walletAPI,
  notificationsAPI,
  dailyCycleAPI,
  weeklyCycleAPI,
  healthAPI,
  request,
  padPin,
  APIError,
};

export default apiClient;
