/**
 * payments.repository.ts
 *
 * All database reads/writes for the payments module.
 * Every write uses inTransaction() with RLS context so Postgres
 * RLS policies enforce tenant isolation at the database layer.
 */

import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { getPool, inTransaction, RlsContext } from '../../config/database.config';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface PaymentRecord {
    id: string;
    user_id: string;
    equb_id: string;
    round_number: number;
    amount: number;
    fee_deducted: number;
    host_commission_deducted: number;
    payment_status: 'pending' | 'paid' | 'auto_debited' | 'failed';
    transaction_reference: string | null;
    paid_at: Date | null;
    created_at: Date;
}

export interface EqubRecord {
    id: string;
    host_id: string;
    name: string;
    total_amount: number;
    contribution_amount: number;
    total_rounds: number;
    current_round: number;
    status: 'open' | 'active' | 'completed' | 'cancelled';
    social_fund_balance: number;
}

export interface WalletRecord {
    id: string;
    user_id: string;
    balance: number;
    currency: string;
}

export interface FeeConfigRecord {
    id: string;
    total_fee_rate: number;
    host_commission_rate: number;
    admin_fee_rate: number;
}

export interface MembershipRecord {
    id: string;
    user_id: string;
    equb_id: string;
    auto_debit_token: string | null;
    consent_granted_at: Date | null;
}

export interface PayoutRecord {
    id: string;
    equb_id: string;
    round_number: number;
    winner_id: string;
    total_pot_amount: number;
    status: 'pending' | 'approved' | 'batched' | 'completed' | 'failed';
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class PaymentsRepository {
    private readonly logger = new Logger(PaymentsRepository.name);

    // ── Fee Config ─────────────────────────────────────────────────────────

    /**
     * Fetches the currently active fee config row set by Admin.
     * Falls back to safe defaults (0.1% / 0.02% / 0.08%) if none found.
     */
    async getActiveFeeConfig(): Promise<FeeConfigRecord> {
        const sql = getPool();

        const rows = await sql<FeeConfigRecord[]>`
      SELECT id, total_fee_rate, host_commission_rate, admin_fee_rate
      FROM fee_config
      WHERE is_active = TRUE
      ORDER BY effective_from DESC
      LIMIT 1
    `;

        return rows[0] ?? {
            id: 'default',
            total_fee_rate: 0.001,
            host_commission_rate: 0.0002,
            admin_fee_rate: 0.0008,
        };
    }

    // ── Equb ───────────────────────────────────────────────────────────────

    async findEqubById(equbId: string): Promise<EqubRecord | null> {
        const sql = getPool();

        const rows = await sql<EqubRecord[]>`
      SELECT id, host_id, name, total_amount, contribution_amount,
             total_rounds, current_round, status, social_fund_balance
      FROM equb_groups
      WHERE id = ${equbId}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    // ── Payment ────────────────────────────────────────────────────────────

    /**
     * Finds a pending payment for a user in a specific round.
     * Used by the double-payment prevention pipeline.
     */
    async findPendingPayment(
        userId: string,
        equbId: string,
        roundNumber: number,
    ): Promise<PaymentRecord | null> {
        const sql = getPool();

        const rows = await sql<PaymentRecord[]>`
      SELECT *
      FROM payments
      WHERE user_id     = ${userId}
        AND equb_id     = ${equbId}
        AND round_number = ${roundNumber}
        AND payment_status = 'pending'
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * SELECT ... FOR UPDATE — must be called inside inTransaction().
     * Locks the payment row so no other process can change it
     * until the transaction commits.
     */
    async lockPaymentForUpdate(
        paymentId: string,
        tx: any,
    ): Promise<PaymentRecord | null> {
        const rows = await tx<PaymentRecord[]>`
      SELECT *
      FROM payments
      WHERE id = ${paymentId}
      FOR UPDATE
    `;

        return rows[0] ?? null;
    }

    async createPendingPayment(
        userId: string,
        equbId: string,
        roundNumber: number,
        amount: number,
        feeDeducted: number,
        hostCommissionDeducted: number,
        ctx: RlsContext,
    ): Promise<PaymentRecord> {
        return inTransaction(ctx, async (tx) => {
            const [payment] = await tx<PaymentRecord[]>`
        INSERT INTO payments
          (user_id, equb_id, round_number, amount, fee_deducted, host_commission_deducted)
        VALUES
          (${userId}, ${equbId}, ${roundNumber}, ${amount}, ${feeDeducted}, ${hostCommissionDeducted})
        RETURNING *
      `;
            return payment;
        });
    }

    /**
     * Marks a payment as paid and records the transaction reference.
     * Must be called inside an open transaction with the row locked.
     */
    async markPaymentPaid(
        paymentId: string,
        transactionReference: string,
        tx: any,
    ): Promise<void> {
        await tx`
      UPDATE payments
      SET payment_status        = 'paid',
          transaction_reference = ${transactionReference},
          paid_at               = NOW(),
          updated_at            = NOW()
      WHERE id = ${paymentId}
        AND payment_status = 'pending'
    `;
    }

    async markPaymentAutoDebited(
        paymentId: string,
        transactionReference: string,
        tx: any,
    ): Promise<void> {
        await tx`
      UPDATE payments
      SET payment_status        = 'auto_debited',
          transaction_reference = ${transactionReference},
          paid_at               = NOW(),
          updated_at            = NOW()
      WHERE id = ${paymentId}
        AND payment_status = 'pending'
    `;
    }

    async markPaymentFailed(paymentId: string, tx: any): Promise<void> {
        await tx`
      UPDATE payments
      SET payment_status = 'failed',
          updated_at     = NOW()
      WHERE id = ${paymentId}
    `;
    }

    /**
     * Confirms a payment from a webhook callback.
     * Matches by transaction_reference (unique per payment) AND processor prefix
     * so a Chapa webhook cannot confirm a Telebirr payment.
     */
    async confirmPaymentByReference(
        txRef: string,
        processor: string,
    ): Promise<PaymentRecord | null> {
        const sql = getPool();

        // Enforce processor match via transaction_reference prefix convention:
        // Chapa refs start with "CHAPA-", Telebirr refs start with "TELEBIRR-"
        const processorPrefix = processor.toUpperCase() + '-';

        const rows = await sql<PaymentRecord[]>`
      UPDATE payments
      SET payment_status = 'paid',
          paid_at        = NOW(),
          updated_at     = NOW()
      WHERE transaction_reference = ${txRef}
        AND transaction_reference LIKE ${processorPrefix + '%'}
        AND payment_status = 'pending'
      RETURNING *
    `;

        return rows[0] ?? null;
    }

    // ── Wallet ─────────────────────────────────────────────────────────────

    async getWalletByUserId(userId: string): Promise<WalletRecord | null> {
        const sql = getPool();

        const rows = await sql<WalletRecord[]>`
      SELECT id, user_id, balance, currency
      FROM wallets
      WHERE user_id = ${userId}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Deducts amount from wallet — must be inside an open transaction.
     * Returns false if balance is insufficient (no negative balances allowed).
     */
    async deductWalletBalance(
        userId: string,
        amount: number,
        tx: any,
    ): Promise<boolean> {
        const result = await tx<{ id: string }[]>`
      UPDATE wallets
      SET balance    = balance - ${amount},
          updated_at = NOW()
      WHERE user_id = ${userId}
        AND balance >= ${amount}
      RETURNING id
    `;

        return result.length > 0;
    }

    /**
     * Credits amount to a wallet (used for host commission + admin fee routing).
     */
    async creditWalletBalance(
        userId: string,
        amount: number,
        tx: any,
    ): Promise<void> {
        await tx`
      UPDATE wallets
      SET balance    = balance + ${amount},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    }

    // ── Membership ─────────────────────────────────────────────────────────

    async getMembership(
        userId: string,
        equbId: string,
    ): Promise<MembershipRecord | null> {
        const sql = getPool();

        const rows = await sql<MembershipRecord[]>`
      SELECT id, user_id, equb_id, auto_debit_token, consent_granted_at
      FROM memberships
      WHERE user_id = ${userId}
        AND equb_id = ${equbId}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Returns all members with auto-debit consent for a given equb and round.
     * Used by the scheduled debit task.
     */
    async getMembersWithAutoDebit(equbId: string): Promise<MembershipRecord[]> {
        const sql = getPool();

        return sql<MembershipRecord[]>`
      SELECT m.id, m.user_id, m.equb_id, m.auto_debit_token, m.consent_granted_at
      FROM memberships m
      WHERE m.equb_id            = ${equbId}
        AND m.auto_debit_token   IS NOT NULL
        AND m.consent_granted_at IS NOT NULL
    `;
    }

    // ── Payout ─────────────────────────────────────────────────────────────

    async createPayout(
        equbId: string,
        roundNumber: number,
        winnerId: string,
        totalPotAmount: number,
        ctx: RlsContext,
    ): Promise<PayoutRecord> {
        return inTransaction(ctx, async (tx) => {
            const [payout] = await tx<PayoutRecord[]>`
        INSERT INTO payouts (equb_id, round_number, winner_id, total_pot_amount)
        VALUES (${equbId}, ${roundNumber}, ${winnerId}, ${totalPotAmount})
        ON CONFLICT (equb_id, round_number) DO NOTHING
        RETURNING *
      `;
            return payout;
        });
    }

    async updatePayoutStatus(
        payoutId: string,
        status: PayoutRecord['status'],
        tx: any,
    ): Promise<void> {
        await tx`
      UPDATE payouts
      SET status = ${status}
      WHERE id = ${payoutId}
    `;
    }

    // ── Pending payments for a round ───────────────────────────────────────

    async getPendingPaymentsForRound(
        equbId: string,
        roundNumber: number,
    ): Promise<PaymentRecord[]> {
        const sql = getPool();

        return sql<PaymentRecord[]>`
      SELECT *
      FROM payments
      WHERE equb_id      = ${equbId}
        AND round_number  = ${roundNumber}
        AND payment_status = 'pending'
    `;
    }

    // ── Admin wallet ID ────────────────────────────────────────────────────

    async getAdminWalletUserId(): Promise<string | null> {
        const sql = getPool();

        const rows = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `;

        return rows[0]?.id ?? null;
    }
}
