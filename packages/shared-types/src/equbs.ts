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

import { UserRole, TrustTier } from './common';

// ── Equb groups ─────────────────────────────────────────────────────────────

/** Matches Postgres `equb_status` enum. */
export type EqubStatus = 'open' | 'active' | 'completed' | 'cancelled';

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
    /** remaining capacity = total_rounds - member_count */
    open_slots: number;
    /** true when the requesting user is the host (present on GET /mine only) */
    is_host?: boolean;
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
    role: UserRole;
    is_active: boolean;
    created_at: string;
}
