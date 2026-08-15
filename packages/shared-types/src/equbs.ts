/**
 * Equb, wallet and ledger shared types.
 *
 * These mirror the backend controller/repository response shapes EXACTLY.
 * Fields are snake_case to match the Postgres columns returned by the API.
 *
 * Keep in sync with:
 *   - apps/backend/src/modules/equbs/equbs.repository.ts
 *   - apps/backend/src/modules/wallet/wallet.repository.ts
 */

import { UserRole } from './common';

// ── Equb groups ─────────────────────────────────────────────────────────────

/** Matches Postgres `equb_status` enum. */
export type EqubStatus = 'open' | 'active' | 'completed' | 'cancelled';

/**
 * Approval state of a user's membership in an Equb.
 *  - 'pending'   join request awaiting admin approval
 *  - 'approved'  active member
 *  - 'rejected'  join request declined by admin (member may re-apply)
 */
export type MembershipStatus = 'pending' | 'approved' | 'rejected';

/** Status of a member's Equb-creation request to the admin. */
export type EqubRequestStatus = 'pending' | 'approved' | 'rejected';

/** Matches Postgres `payment_status` enum. */
export type PaymentStatus = 'pending' | 'paid' | 'auto_debited' | 'failed';

/** Matches Postgres `payout_status` enum. */
export type PayoutStatus = 'pending' | 'approved' | 'batched' | 'completed' | 'failed';

/**
 * An Equb group as returned by GET /api/v1/equbs.
 * Enriched with host identity and live member count.
 */
export interface EqubGroup {
    id: string;
    host_id: string;
    name: string;
    description: string | null;
    telegram_group_id: number | null;
    total_amount: number;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
    current_round: number;
    status: EqubStatus;
    social_fund_balance: number;
    created_at: string;
    updated_at: string;
    host_first_name: string;
    host_last_name: string;
    host_phone: string;
    member_count: number;
    /** remaining capacity = total_rounds - member_count (approved members only) */
    open_slots: number;
    /** true when the requesting user is the host (present on GET /mine only) */
    is_host?: boolean;
    /**
     * The requesting user's membership approval state.
     * Present on GET /equbs/mine and GET /equbs/:id. 'pending' means the
     * member requested to join but has not been approved by an admin yet.
     */
    membership_status?: MembershipStatus;
}

// ── Equb creation requests (member asks the admin) ─────────────────────────

/**
 * A member's request for the admin to create a new Equb
 * (GET /api/v1/equbs/requests/mine, GET /api/v1/admin/equb-requests).
 */
export interface EqubCreationRequest {
    id: string;
    requester_id: string;
    name: string;
    description: string | null;
    contribution_amount: number;
    cycle_days: number;
    total_rounds: number;
    status: EqubRequestStatus;
    admin_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
    /** Requester identity — present on the admin listing only. */
    requester_first_name?: string;
    requester_last_name?: string;
    requester_phone?: string;
    requester_email?: string;
}

// ── Wallet ───────────────────────────────────────────────────────────────────

/** Wallet row returned by GET /api/v1/wallets/me. */
export interface Wallet {
    id: string;
    user_id: string;
    balance: number;
    currency: string;
}

// ── Ledger transactions ─────────────────────────────────────────────────────

/**
 * A single row in the wallet transaction history
 * (GET /api/v1/wallets/me/transactions).
 *
 * `direction` is:
 *   - 'payment'    money out — Equb contribution
 *   - 'payout'     money in  — Equb payout won
 *   - 'deposit'    money in  — wallet top-up (wallet_transactions)
 *   - 'withdrawal' money out — wallet cash-out (wallet_transactions)
 */
export interface WalletTransaction {
    id: string;
    direction: 'payment' | 'payout' | 'deposit' | 'withdrawal';
    amount: number;
    status: PaymentStatus | PayoutStatus;
    paid_at: string | null;
    created_at: string;
    /** Equb name for payment/payout; transaction reference for deposit/withdrawal. */
    equb_name: string;
    round_number: number | null;
}

// ── Notification ─────────────────────────────────────────────────────────────

/** Matches Postgres `alert_category` enum. */
export type AlertCategory = 'operational' | 'social_trust' | 'system_policy';

/** Notification row returned by GET /api/v1/notifications. */
export interface Notification {
    id: string;
    user_id: string;
    category: AlertCategory;
    title: string;
    body: string;
    is_read: boolean;
    delivered_channels: string[] | null;
    created_at: string;
}

// ── User profile ─────────────────────────────────────────────────────────────

/** Profile returned by GET /api/v1/users/me. */
export interface UserProfileData {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    telegram_handle: string | null;
    /** Base64 data URL of the user's profile photo, if set. */
    profile_photo: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
}
