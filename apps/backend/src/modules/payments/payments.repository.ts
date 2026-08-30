/**
 * payments.repository.ts
 *
 * All database reads/writes for the payments module.
 * Every write uses inTransaction() with RLS context so Postgres
 * RLS policies enforce tenant isolation at the database layer.
 */

import {
    Injectable,
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
    status: 'pending' | 'approved' | 'rejected';
    auto_debit_token: string | null;
    consent_granted_at: Date | null;
}

export interface WebhookEventRecord {
    id: string;
    provider: string;
    tx_ref: string;
    status: string;
    payload: any;
    processed: boolean;
    processed_at: Date | null;
    created_at: Date;
}

export interface PayoutRecord {
    id: string;
    equb_id: string;
    round_number: number;
    winner_id: string;
    total_pot_amount: number;
    status: 'pending' | 'approved' | 'batched' | 'completed' | 'failed';
}

export interface LotteryCandidate {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
}

export interface LotteryDrawRecord {
    id: string;
    equb_id: string;
    round_number: number;
    winner_id: string;
    draw_timestamp: Date;
    video_url: string | null;
    svg_canvas_data: string | null;
    is_purged: boolean;
}

export interface LotteryDrawListItem {
    id: string;
    round_number: number;
    winner_id: string;
    draw_timestamp: Date;
    winner_first_name: string;
    winner_last_name: string;
    winner_phone: string;
}

export interface EqubRoundInfo {
    id: string;
    host_id: string;
    name: string;
    total_amount: number;
    contribution_amount: number;
    total_rounds: number;
    current_round: number;
    status: 'open' | 'active' | 'completed' | 'cancelled';
}

/** A lottery spin candidate: the user plus their membership id (needed to
 *  write both winner state and the immutable event row). */
export interface LotterySpinCandidate extends LotteryCandidate {
    membership_id: string;
}

/** An immutable lottery ledger event (see migration 014). */
export interface LotteryEventRecord {
    id: string;
    equb_id: string;
    round_number: number;
    membership_id: string | null;
    winner_id: string | null;
    event_type: 'LOTTERY_WIN' | 'DRAW_SKIPPED' | 'PAYOUT_SCHEDULED';
    performed_by: string | null;
    draw_timestamp: Date;
    metadata: any;
}

export type BidStatus = 'open' | 'winning' | 'outbid' | 'settled';

export interface BidRecord {
    id: string;
    equb_id: string;
    user_id: string;
    round_number: number;
    bid_amount: number;
    potential_payout: number;
    status: BidStatus;
    created_at: Date;
    first_name?: string;
    last_name?: string;
    phone?: string;
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
        provider: string = 'wallet',
        ctx: RlsContext,
    ): Promise<PaymentRecord> {
        return inTransaction(ctx, async (tx) => {
            const [payment] = await tx<PaymentRecord[]>`
        INSERT INTO payments
          (user_id, equb_id, round_number, amount, fee_deducted, host_commission_deducted, provider)
        VALUES
          (${userId}, ${equbId}, ${roundNumber}, ${amount}, ${feeDeducted}, ${hostCommissionDeducted}, ${provider})
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
     * Matches by transaction_reference (unique per payment).
     */
    async confirmPaymentByReference(
        txRef: string,
        _processor: string,
    ): Promise<PaymentRecord | null> {
        const sql = getPool();

        const rows = await sql<PaymentRecord[]>`
      UPDATE payments
      SET payment_status = 'paid',
          paid_at        = NOW(),
          updated_at     = NOW()
      WHERE transaction_reference = ${txRef}
        AND payment_status = 'pending'
      RETURNING *
    `;

        return rows[0] ?? null;
    }

    // ── Webhook idempotency (Tier 3 duplicate-event protection) ────────────

    /**
     * Records an incoming webhook event. Returns null when an identical
     * (provider, tx_ref, status) event has already been recorded — the caller
     * then skips processing (idempotent webhooks).
     */
    async recordWebhookEvent(
        provider: string,
        txRef: string,
        status: string,
        payload: unknown,
        processed: boolean,
    ): Promise<WebhookEventRecord | null> {
        const sql = getPool();

        const rows = await sql<WebhookEventRecord[]>`
      INSERT INTO webhook_events (provider, tx_ref, status, payload, processed)
      VALUES (${provider}, ${txRef}, ${status}, ${JSON.stringify(payload)}, ${processed})
      ON CONFLICT (provider, tx_ref, status) DO NOTHING
      RETURNING id, provider, tx_ref, status, payload, processed, processed_at, created_at
    `;

        return rows[0] ?? null;
    }

    /** Marks a recorded webhook event as fully processed. */
    async markWebhookEventProcessed(eventId: string): Promise<void> {
        const sql = getPool();

        await sql`
      UPDATE webhook_events
      SET processed    = TRUE,
          processed_at = NOW()
      WHERE id = ${eventId}
    `;
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
      SELECT id, user_id, equb_id, status, auto_debit_token, consent_granted_at
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

    // ── Bidding Auction (spec §3.4) ────────────────────────────────────────

    /**
     * Records a member's discount bid for a round. One standing bid per
     * (equb, round, member) — a later bid raises the previous one. The
     * `inserted` flag distinguishes a fresh bid from a raise (xmax = 0
     * means the row was inserted, not updated).
     */
    async createBid(
        equbId: string,
        userId: string,
        roundNumber: number,
        bidAmount: number,
        potentialPayout: number,
        ctx: RlsContext,
    ): Promise<{ id: string; bid_amount: number; potential_payout: number; status: BidStatus; inserted: boolean }> {
        return inTransaction(ctx, async (tx) => {
            const [row] = await tx<{
                id: string;
                bid_amount: number;
                potential_payout: number;
                status: BidStatus;
                inserted: boolean;
            }[]>`
        INSERT INTO equb_bids (equb_id, user_id, round_number, bid_amount, potential_payout)
        VALUES (${equbId}, ${userId}, ${roundNumber}, ${bidAmount}, ${potentialPayout})
        ON CONFLICT (equb_id, round_number, user_id) DO UPDATE
          SET bid_amount       = EXCLUDED.bid_amount,
              potential_payout = EXCLUDED.potential_payout,
              status           = 'open',
              updated_at       = NOW()
        RETURNING id, bid_amount, potential_payout, status, (xmax = 0) AS inserted
      `;
            return row;
        });
    }

    /**
     * Lists every bid for a round, highest first. Used for the auction
     * leaderboard and by the resolution logic.
     */
    async getRoundBids(
        equbId: string,
        roundNumber: number,
    ): Promise<BidRecord[]> {
        const sql = getPool();

        return sql<BidRecord[]>`
      SELECT b.id, b.equb_id, b.user_id, b.round_number, b.bid_amount,
             b.potential_payout, b.status, b.created_at,
             u.first_name, u.last_name, u.phone
      FROM equb_bids b
      JOIN users u ON u.id = b.user_id
      WHERE b.equb_id      = ${equbId}
        AND b.round_number = ${roundNumber}
      ORDER BY b.bid_amount DESC, b.created_at ASC
    `;
    }

    /** Returns the winning bid for a round (null if the auction is open). */
    async getWinningBid(
        equbId: string,
        roundNumber: number,
    ): Promise<BidRecord | null> {
        const sql = getPool();

        const rows = await sql<BidRecord[]>`
      SELECT b.id, b.equb_id, b.user_id, b.round_number, b.bid_amount,
             b.potential_payout, b.status, b.created_at,
             u.first_name, u.last_name, u.phone
      FROM equb_bids b
      JOIN users u ON u.id = b.user_id
      WHERE b.equb_id      = ${equbId}
        AND b.round_number = ${roundNumber}
        AND b.status       = 'winning'
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Resolves an auction for a round in a single ACID transaction:
     * marks the highest bidder as winning, everyone else as outbid, and
     * records the winner's payout. Idempotent per round — a second call
     * returns the existing winning bid without re-marking anything.
     */
    async resolveAuction(
        equbId: string,
        roundNumber: number,
        winnerId: string,
        payoutAmount: number,
        ctx: RlsContext,
    ): Promise<{ bidId: string; inserted: boolean }> {
        return inTransaction(ctx, async (tx) => {
            const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM equb_bids
        WHERE equb_id      = ${equbId}
          AND round_number = ${roundNumber}
          AND status       = 'winning'
        LIMIT 1
      `;
            if (existing) {
                return { bidId: existing.id, inserted: false };
            }

            const [winner] = await tx<{ id: string }[]>`
        UPDATE equb_bids
        SET status     = 'winning',
            updated_at = NOW()
        WHERE equb_id      = ${equbId}
          AND round_number = ${roundNumber}
          AND user_id      = ${winnerId}
        RETURNING id
      `;

            await tx`
        UPDATE equb_bids
        SET status     = 'outbid',
            updated_at = NOW()
        WHERE equb_id      = ${equbId}
          AND round_number = ${roundNumber}
          AND user_id      <> ${winnerId}
      `;

            await tx`
        INSERT INTO payouts (equb_id, round_number, winner_id, total_pot_amount)
        VALUES (${equbId}, ${roundNumber}, ${winnerId}, ${payoutAmount})
        ON CONFLICT (equb_id, round_number) DO NOTHING
      `;

            return { bidId: winner.id, inserted: true };
        });
    }

    // ── Admin wallet ID ────────────────────────────────────────────────────

    async getAdminWalletUserId(): Promise<string | null> {
        const sql = getPool();

        const rows = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `;

        return rows[0]?.id ?? null;
    }

    // ── Lottery ────────────────────────────────────────────────────────────

    /**
     * Returns the lottery-eligible member set for a given round:
     * memberships approved AND a payment recorded as paid / auto_debited
     * for that round. Only paying members can win (spec §4.2).
     */
    async getEligibleMembersForDraw(
        equbId: string,
        roundNumber: number,
    ): Promise<LotteryCandidate[]> {
        const sql = getPool();

        return sql<LotteryCandidate[]>`
      SELECT DISTINCT u.id,
                      u.first_name,
                      u.last_name,
                      u.phone
      FROM memberships m
      JOIN users       u ON u.id = m.user_id
      JOIN payments    p ON p.user_id  = m.user_id
                        AND p.equb_id  = m.equb_id
                        AND p.round_number = ${roundNumber}
      WHERE m.equb_id  = ${equbId}
        AND m.status   = 'approved'
        AND p.payment_status IN ('paid', 'auto_debited')
      ORDER BY u.first_name, u.last_name
    `;
    }

    /**
     * Returns the existing draw for a round (null if none yet).
     * Used for idempotency — one draw per (equb, round).
     */
    async getLotteryDraw(
        equbId: string,
        roundNumber: number,
    ): Promise<LotteryDrawRecord | null> {
        const sql = getPool();

        const rows = await sql<LotteryDrawRecord[]>`
      SELECT id, equb_id, round_number, winner_id,
             draw_timestamp, video_url, svg_canvas_data, is_purged
      FROM lottery_draws
      WHERE equb_id      = ${equbId}
        AND round_number = ${roundNumber}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Inserts a lottery draw row. One draw per (equb, round) — enforced by a
     * UNIQUE constraint, so concurrent double-clicks are safe.
     * Returns null when a draw already exists for that round.
     */
    async createLotteryDraw(
        equbId: string,
        roundNumber: number,
        winnerId: string,
        svgCanvasData: string | null,
        ctx: RlsContext,
    ): Promise<LotteryDrawRecord | null> {
        return inTransaction(ctx, async (tx) => {
            const rows = await tx<LotteryDrawRecord[]>`
        INSERT INTO lottery_draws (equb_id, round_number, winner_id, svg_canvas_data)
        VALUES (${equbId}, ${roundNumber}, ${winnerId}, ${svgCanvasData})
        ON CONFLICT (equb_id, round_number) DO NOTHING
        RETURNING id, equb_id, round_number, winner_id,
                  draw_timestamp, video_url, svg_canvas_data, is_purged
      `;
            return rows[0] ?? null;
        });
    }

    /**
     * Lists every draw for an equb, newest first, joined with winner names
     * so the UI can render a history of winners.
     */
    async getLotteryDraws(equbId: string): Promise<LotteryDrawListItem[]> {
        const sql = getPool();

        return sql<LotteryDrawListItem[]>`
      SELECT d.id, d.round_number, d.winner_id, d.draw_timestamp,
             u.first_name AS winner_first_name,
             u.last_name  AS winner_last_name,
             u.phone      AS winner_phone
      FROM lottery_draws d
      JOIN users u ON u.id = d.winner_id
      WHERE d.equb_id = ${equbId}
        AND d.is_purged = FALSE
      ORDER BY d.round_number DESC
    `;
    }

    /**
     * Advances the equb's current round (and marks it completed once the
     * final round has been paid out). Call after a successful draw.
     */
    async advanceEqubRound(equbId: string, ctx: RlsContext): Promise<void> {
        await inTransaction(ctx, async (tx) => {
            await tx`
        UPDATE equb_groups
        SET current_round = LEAST(current_round + 1, total_rounds),
            status        = CASE
                              WHEN current_round + 1 >= total_rounds THEN 'completed'::equb_status
                              ELSE status
                            END,
            updated_at    = NOW()
        WHERE id = ${equbId}
      `;
        });
    }

    /** Returns the group's basic round metadata for a draw. */
    async getEqubRoundInfo(equbId: string): Promise<EqubRoundInfo | null> {
        const sql = getPool();

        const rows = await sql<EqubRoundInfo[]>`
      SELECT id, host_id, name, total_amount, contribution_amount,
             total_rounds, current_round, status
      FROM equb_groups
      WHERE id = ${equbId}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    // ── Lottery spin — single-transaction primitives ────────────────────────
    //
    // These methods MUST be called from inside a single inTransaction() opened
    // by the service. They share the caller's `tx` so the whole spin (lock,
    // eligibility, winner write, immutable event, payout, round advance) is
    // atomic: any failure rolls everything back.

    /**
     * Locks the equb's current round row FOR UPDATE so two concurrent spins
     * on the same equb serialize: the second one waits for the first to
     * commit/rollback, then re-reads the (now advanced) current_round.
     */
    async lockEqubCycleForUpdate(
        equbId: string,
        tx: any,
    ): Promise<EqubRoundInfo | null> {
        const rows = await tx<EqubRoundInfo[]>`
      SELECT id, host_id, name, total_amount, contribution_amount,
             total_rounds, current_round, status
      FROM equb_groups
      WHERE id = ${equbId}
      FOR UPDATE
    `;

        return rows[0] ?? null;
    }

    /**
     * Fetches the lottery-eligible candidates for the round INSIDE the spin
     * transaction, excluding any member who has already won the current
     * cycle (won_current_cycle = TRUE). Only approved members with a paid /
     * auto_debited contribution for the round are considered.
     */
    async getEligibleCandidatesForSpinRound(
        equbId: string,
        roundNumber: number,
        tx: any,
    ): Promise<LotterySpinCandidate[]> {
        return tx<LotterySpinCandidate[]>`
      SELECT DISTINCT u.id,
                      u.first_name,
                      u.last_name,
                      u.phone,
                      m.id AS membership_id
      FROM memberships m
      JOIN users       u ON u.id = m.user_id
      JOIN payments    p ON p.user_id  = m.user_id
                        AND p.equb_id  = m.equb_id
                        AND p.round_number = ${roundNumber}
      WHERE m.equb_id  = ${equbId}
        AND m.status   = 'approved'
        AND m.won_current_cycle = FALSE
        AND p.payment_status IN ('paid', 'auto_debited')
      ORDER BY u.first_name, u.last_name
    `;
    }

    /** tx-scoped idempotent draw insert (ON CONFLICT round = no-op). */
    async createLotteryDrawInTx(
        equbId: string,
        roundNumber: number,
        winnerId: string,
        svgCanvasData: string | null,
        tx: any,
    ): Promise<LotteryDrawRecord | null> {
        const rows = await tx<LotteryDrawRecord[]>`
      INSERT INTO lottery_draws (equb_id, round_number, winner_id, svg_canvas_data)
      VALUES (${equbId}, ${roundNumber}, ${winnerId}, ${svgCanvasData})
      ON CONFLICT (equb_id, round_number) DO NOTHING
      RETURNING id, equb_id, round_number, winner_id,
                draw_timestamp, video_url, svg_canvas_data, is_purged
    `;
        return rows[0] ?? null;
    }

    /**
     * Idempotency guard executed within the spin transaction. Returns the
     * existing draw row for a round if one already exists (a concurrent
     * spin that committed before this one was granted the row lock).
     */
    async getExistingDrawInTx(
        equbId: string,
        roundNumber: number,
        tx: any,
    ): Promise<LotteryDrawRecord | null> {
        const rows = await tx<LotteryDrawRecord[]>`
      SELECT id, equb_id, round_number, winner_id,
             draw_timestamp, video_url, svg_canvas_data, is_purged
      FROM lottery_draws
      WHERE equb_id      = ${equbId}
        AND round_number = ${roundNumber}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    /**
     * Marks the winner's membership as having won the current cycle. Called
     * inside the spin transaction so it commits atomically with the ledger.
     */
    async markMembershipWonCycle(
        membershipId: string,
        roundNumber: number,
        tx: any,
    ): Promise<void> {
        await tx`
      UPDATE memberships
      SET won_current_cycle = TRUE,
          won_round_number  = ${roundNumber},
          updated_at        = NOW()
      WHERE id = ${membershipId}
    `;
    }

    /**
     * Inserts an immutable lottery event into the append-only ledger. The
     * partial unique index uq_lottery_win_per_member rejects a second
     * LOTTERY_WIN for the same (equb, winner), failing the whole spin.
     */
    async insertLotteryEvent(
        equbId: string,
        roundNumber: number,
        membershipId: string | null,
        winnerId: string | null,
        eventType: 'LOTTERY_WIN' | 'DRAW_SKIPPED' | 'PAYOUT_SCHEDULED',
        performedBy: string | null,
        metadata: any,
        tx: any,
    ): Promise<LotteryEventRecord> {
        const [row] = await tx<LotteryEventRecord[]>`
      INSERT INTO lottery_events
        (equb_id, round_number, membership_id, winner_id, event_type, performed_by, metadata)
      VALUES
        (${equbId}, ${roundNumber}, ${membershipId}, ${winnerId}, ${eventType}, ${performedBy}, ${JSON.stringify(metadata ?? {})})
      RETURNING id, equb_id, round_number, membership_id, winner_id,
                event_type, performed_by, draw_timestamp, metadata
    `;

        return row;
    }

    /** tx-scoped payout insert (idempotent per equb/round). */
    async createPayoutInTx(
        equbId: string,
        roundNumber: number,
        winnerId: string,
        totalPotAmount: number,
        tx: any,
    ): Promise<PayoutRecord> {
        const [payout] = await tx<PayoutRecord[]>`
      INSERT INTO payouts (equb_id, round_number, winner_id, total_pot_amount)
      VALUES (${equbId}, ${roundNumber}, ${winnerId}, ${totalPotAmount})
      ON CONFLICT (equb_id, round_number) DO NOTHING
      RETURNING *
    `;
        return payout;
    }

    /** tx-scoped round advance (completes after the final round). */
    async advanceEqubRoundInTx(equbId: string, tx: any): Promise<void> {
        await tx`
      UPDATE equb_groups
      SET current_round = LEAST(current_round + 1, total_rounds),
          status        = CASE
                            WHEN current_round + 1 >= total_rounds THEN 'completed'::equb_status
                            ELSE status
                          END,
          updated_at    = NOW()
      WHERE id = ${equbId}
    `;
    }
}
