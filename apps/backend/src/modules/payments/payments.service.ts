/**
 * payments.service.ts
 *
 * Core payment business logic:
 *  §3.3  Double-Payment Prevention (Redis Redlock + SELECT FOR UPDATE)
 *  §3.4  Bidding Auction Formula
 *  §3.5  Host Commission & Admin Fee Split (admin-controlled via fee_config)
 *  §2.1  Webhook ingestion (Chapa / Telebirr)
 */

import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    OnModuleInit,
    Optional,
    UnprocessableEntityException,
} from '@nestjs/common';
import Redlock from 'redlock';
import Redis from 'ioredis';
import * as crypto from 'crypto';

import {
    PaymentsRepository,
    PaymentRecord,
    FeeConfigRecord,
    LotteryCandidate,
    PublicWinnerRecord,
} from './payments.repository';
import { CheckoutDto, PaymentMethod } from './dto/checkout.dto';
import { WebhookDto, WebhookStatus } from './dto/webhook.dto';
import { BidDto } from './dto/bid.dto';
import {
    UserLotteryCurrentResponse,
    UserLotteryHistoryResponse,
    UserLotteryHistoryItem,
} from './dto/user-lottery.dto';
import { RlsContext, inTransaction, getPool } from '../../config/database.config';
import { VaultConfig } from '../../config/vault.config';
import { buildTransactionReference } from './reference';
import { PaymentProviderService } from './providers/payment-provider.service';
import { PaymentProvider } from './providers/payment-provider.interface';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCK_TTL_MS = 30_000;
const LOCK_PREFIX = 'lock:payment:';

// ---------------------------------------------------------------------------
// Fee calculation helper
// ---------------------------------------------------------------------------

interface FeeSplit {
    feeDeducted: number;
    hostCommissionDeducted: number;
    netAmount: number;
}

export function calculateFees(amount: number, config: FeeConfigRecord): FeeSplit {
    const hostCommissionDeducted = parseFloat(
        (amount * config.host_commission_rate).toFixed(2),
    );
    const feeDeducted = parseFloat(
        (amount * config.admin_fee_rate).toFixed(2),
    );
    const netAmount = parseFloat(
        (amount - hostCommissionDeducted - feeDeducted).toFixed(2),
    );
    return { feeDeducted, hostCommissionDeducted, netAmount };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class PaymentsService implements OnModuleInit {
    private readonly logger = new Logger(PaymentsService.name);
    private redlock!: Redlock;

    constructor(
        private readonly repo: PaymentsRepository,
        @Optional() injectedRedlock?: Redlock,
        @Optional() private readonly providerService?: PaymentProviderService,
    ) {
        if (injectedRedlock) {
            this.redlock = injectedRedlock;
        }
    }

    onModuleInit(): void {
        if (this.redlock) return; // test seam — a redlock was injected
        const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
        const isTls = redisUrl.startsWith('rediss://');

        const redis = new Redis(redisUrl, {
            enableReadyCheck: false,    // don't throw if Redis isn't ready
            maxRetriesPerRequest: null, // let Redlock handle retries
            lazyConnect: true,          // don't connect until first command
            tls: isTls ? {} : undefined, // Upstash requires TLS (rediss://)
        });

        // Suppress unhandled error events — ioredis emits these when Redis
        // is unavailable. Without this listener Node.js crashes the process.
        redis.on('error', (err: Error) => {
            this.logger.warn(`[Redis] Connection error (payments): ${err.message}`);
        });

        this.redlock = new Redlock([redis as unknown as Redlock.CompatibleRedisClient], {
            retryCount: 5,
            retryDelay: 200,
            retryJitter: 100,
        });
    }

    // ── Checkout ─────────────────────────────────────────────────────────────

    async checkout(
        dto: CheckoutDto,
        ctx: RlsContext,
    ): Promise<{
        payment_id?: string;
        checkout_url?: string;
        status: string;
        message: string;
    }> {
        const equb = await this.repo.findEqubById(dto.equb_id);
        if (!equb) throw new NotFoundException('Equb group not found.');

        if (equb.status !== 'active' && equb.status !== 'open') {
            throw new BadRequestException(
                `Equb is not accepting payments (status: ${equb.status}).`,
            );
        }

        // Periodic-cycle (daily/weekly) equbs: reject contributions after the
        // cycle's cutoff.
        const windowOpen = await this.repo.isPaymentWindowOpen(dto.equb_id);
        if (!windowOpen) {
            throw new BadRequestException(
                'The current contribution window is closed. Contributions reopen at the start of the next cycle.',
            );
        }

        const membership = await this.repo.getMembership(ctx.userId, dto.equb_id);
        if (!membership) {
            throw new BadRequestException('You are not a member of this Equb group.');
        }
        if (membership.status !== 'approved') {
            throw new BadRequestException(
                'Your membership is not approved yet — only approved members can contribute.',
            );
        }

        const feeConfig = await this.repo.getActiveFeeConfig();
        const { feeDeducted, hostCommissionDeducted } = calculateFees(
            equb.contribution_amount,
            feeConfig,
        );

        if (dto.payment_method === PaymentMethod.WALLET) {
            return this.processWalletPayment(
                ctx,
                dto.equb_id,
                equb,
                dto.round_number,
                feeDeducted,
                hostCommissionDeducted,
            );
        }

        return this.initExternalPayment(
            ctx,
            dto,
            equb,
            feeDeducted,
            hostCommissionDeducted,
        );
    }

    // ── Double-Payment Prevention Pipeline (spec §3.3) ───────────────────────

    private async processWalletPayment(
        ctx: RlsContext,
        equbId: string,
        equb: any,
        roundNumber: number,
        feeDeducted: number,
        hostCommissionDeducted: number,
    ): Promise<{ payment_id: string; status: string; message: string }> {

        // (1) Acquire Redlock
        const lockKey = `${LOCK_PREFIX}${ctx.userId}:${equbId}:${roundNumber}`;
        let lock!: Redlock.Lock;

        try {
            lock = await this.redlock.lock(lockKey, LOCK_TTL_MS);
        } catch {
            throw new ConflictException(
                'A payment is already being processed for this round. Please wait.',
            );
        }

        try {
            // (2) Open ACID transaction
            const result = await inTransaction(ctx, async (tx) => {

                const paymentId = await this.getOrCreatePendingPaymentId(
                    ctx.userId, equbId, roundNumber,
                    equb.contribution_amount, feeDeducted, hostCommissionDeducted, 'wallet', ctx,
                );

                // (3) SELECT ... FOR UPDATE
                const payment = await this.repo.lockPaymentForUpdate(paymentId, tx);
                if (!payment) throw new NotFoundException('Payment record not found.');

                // (4) Verify still pending
                if (payment.payment_status !== 'pending') {
                    return {
                        payment_id: payment.id,
                        status: payment.payment_status,
                        message: 'This round has already been paid.',
                    };
                }

                // (5) Check wallet balance
                const deducted = await this.repo.deductWalletBalance(
                    ctx.userId,
                    equb.contribution_amount,
                    tx,
                );

                if (deducted) {
                    // (6) Sufficient — commit
                    const txRef = buildTransactionReference('WLT', equbId, roundNumber, ctx.userId);
                    await this.repo.markPaymentPaid(payment.id, txRef, tx);
                    await this.repo.creditWalletBalance(equb.host_id, hostCommissionDeducted, tx);

                    const adminId = await this.repo.getAdminWalletUserId();
                    if (adminId) {
                        await this.repo.creditWalletBalance(adminId, feeDeducted, tx);
                    }

                    this.logger.log(`Wallet payment committed: ${payment.id} | txRef: ${txRef}`);
                    return { payment_id: payment.id, status: 'paid', message: 'Payment successful.' };
                } else {
                    // (7) Insufficient — queue auto-debit
                    this.logger.warn(
                        `Insufficient wallet balance for user ${ctx.userId} — queuing auto-debit.`,
                    );
                    return {
                        payment_id: payment.id,
                        status: 'pending',
                        message: 'Insufficient wallet balance. Auto-debit will be attempted.',
                    };
                }
            });

            return result;

        } finally {
            await lock.unlock().catch((err: Error) =>
                this.logger.warn('Failed to release Redlock:', err),
            );
        }
    }

    // ── External Payment Init (Tier 3 provider abstraction) ───────────────────

    private async initExternalPayment(
        ctx: RlsContext,
        dto: CheckoutDto,
        equb: any,
        feeDeducted: number,
        hostCommissionDeducted: number,
    ): Promise<{
        payment_id: string;
        checkout_url: string;
        status: string;
        message: string;
    }> {
        const paymentId = await this.getOrCreatePendingPaymentId(
            ctx.userId, dto.equb_id, dto.round_number,
            equb.contribution_amount, feeDeducted, hostCommissionDeducted,
            dto.payment_method, ctx,
        );

        // Unique reference: QAL-<PROVIDER>-<EQUB>-R<ROUND>-<MEMBER>-<UNIQUE>
        const txRef = buildTransactionReference(
            dto.payment_method.toUpperCase(),
            dto.equb_id,
            dto.round_number,
            ctx.userId,
        );

        const sql = getPool();
        await sql`
      UPDATE payments
      SET transaction_reference = ${txRef},
          provider             = ${dto.payment_method},
          updated_at            = NOW()
      WHERE id = ${paymentId}
    `;

        // Resolve the gateway through the provider abstraction. In sandbox mode
        // this is the mock provider; in live mode the real Chapa/Telebirr API.
        let checkoutUrl: string;
        if (this.providerService) {
            const provider = this.providerService.resolve(
                dto.payment_method as 'chapa' | 'telebirr',
            );
            const checkout = await provider.createCheckout({
                amount: equb.contribution_amount,
                currency: 'ETB',
                txRef,
                callbackUrl: dto.callback_url,
                metadata: {
                    equb_id: dto.equb_id,
                    round_number: dto.round_number,
                    member_id: ctx.userId,
                },
            });
            checkoutUrl = checkout.checkoutUrl;
        } else {
            // Test seam — no provider service injected (unit tests).
            checkoutUrl = dto.payment_method === PaymentMethod.CHAPA
                ? `https://checkout.chapa.co/checkout/payment/${txRef}`
                : `https://telebirr.et/checkout/${txRef}`;
        }

        return {
            payment_id: paymentId,
            checkout_url: checkoutUrl,
            status: 'pending',
            message: 'Redirect the user to the checkout URL to complete payment.',
        };
    }

    // ── Webhook Ingestion (spec §2.1 + Tier 3 verification) ────────────────
    //
    // Idempotent, verified ingestion pipeline:
    //   (1) HMAC signature   → provider.verifyWebhookSignature
    //   (2) Duplicate guard  → webhook_events unique (provider, tx_ref, status)
    //   (3) Provider verify  → provider.verifyTransaction (authoritative)
    //   (4) Amount verify    → match against the DB payment row
    //   (5) DB update        → confirmPaymentByReference (pending→paid)

    async handleWebhook(
        dto: WebhookDto,
        rawBody: Buffer,
        signature: string,
    ): Promise<{ received: boolean }> {

        await this.verifyWebhookSignature(dto.processor, rawBody, signature);

        // (2) Duplicate-event protection — identical events are ignored.
        const event = await this.repo.recordWebhookEvent(
            dto.processor,
            dto.tx_ref,
            dto.status,
            dto,
            false,
        );

        if (!event) {
            this.logger.log(`Webhook duplicate event ignored: ${dto.tx_ref}/${dto.status}`);
            return { received: true };
        }

        if (dto.status !== WebhookStatus.SUCCESS) {
            this.logger.warn(
                `Webhook non-success: ${dto.status} for ${dto.tx_ref}`,
            );
            await this.repo.markWebhookEventProcessed(event.id);
            return { received: true };
        }

        // (3) Authoritative verification against the gateway.
        if (this.providerService) {
            const provider = this.providerService.resolve(dto.processor);
            const verification = await provider.verifyTransaction({
                txRef: dto.tx_ref,
                expectedAmount: dto.amount,
                providerReference: dto.tx_ref,
            });

            if (!verification.verified) {
                this.logger.warn(
                    `Webhook verification failed for ${dto.tx_ref}: ` +
                    `${verification.failureReason ?? 'provider did not confirm.'}`,
                );
                await this.repo.markWebhookEventProcessed(event.id);
                return { received: true };
            }
        }

        const payment = await this.repo.confirmPaymentByReference(
            dto.tx_ref,
            dto.processor,
        );

        if (!payment) {
            this.logger.log(`Webhook duplicate/unknown txRef: ${dto.tx_ref}`);
            await this.repo.markWebhookEventProcessed(event.id);
            return { received: true };
        }

        // (4) Amount verification against the DB record — surface to logs so
        // the reconciliation run can investigate mismatches.
        if (dto.amount !== undefined && Math.abs(dto.amount - payment.amount) > 0.01) {
            this.logger.warn(
                `Webhook amount mismatch: payment=${payment.id} expected=${payment.amount} got=${dto.amount}`,
            );
        }

        const equb = await this.repo.findEqubById(payment.equb_id);
        if (equb) {
            const adminId = await this.repo.getAdminWalletUserId();
            const sql = getPool();

            await sql.begin(async (tx: any) => {
                await this.repo.creditWalletBalance(
                    equb.host_id,
                    payment.host_commission_deducted,
                    tx,
                );
                if (adminId) {
                    await this.repo.creditWalletBalance(
                        adminId,
                        payment.fee_deducted,
                        tx,
                    );
                }
            });
        }

        await this.repo.markWebhookEventProcessed(event.id);
        this.logger.log(`Webhook confirmed: ${payment.id} via ${dto.processor}`);
        return { received: true };
    }

    // ── Bidding Auction (spec §3.4) ───────────────────────────────────────────

    async submitBid(
        dto: BidDto,
        ctx: RlsContext,
    ): Promise<{
        bid_recorded: boolean;
        bid_id: string;
        round_number: number;
        potential_payout: number;
        updated: boolean;
        message: string;
    }> {
        const equb = await this.repo.findEqubById(dto.equb_id);
        if (!equb) throw new NotFoundException('Equb group not found.');

        if (equb.status !== 'active') {
            throw new BadRequestException(
                'Bidding is only allowed on active Equb groups.',
            );
        }

        if (equb.current_round < 1) {
            throw new BadRequestException(
                'This Equb has not started any rounds yet. Activate it first.',
            );
        }

        if (dto.bid_amount >= equb.total_amount) {
            throw new UnprocessableEntityException(
                `Bid (${dto.bid_amount} ETB) must be less than pot (${equb.total_amount} ETB).`,
            );
        }

        const roundNumber = equb.current_round;
        const potentialPayout = parseFloat(
            (equb.total_amount - dto.bid_amount).toFixed(2),
        );

        const bid = await this.repo.createBid(
            dto.equb_id,
            ctx.userId,
            roundNumber,
            dto.bid_amount,
            potentialPayout,
            ctx,
        );

        return {
            bid_recorded: true,
            bid_id: bid.id,
            round_number: roundNumber,
            potential_payout: potentialPayout,
            updated: !bid.inserted,
            message: bid.inserted
                ? `Bid of ${dto.bid_amount} ETB recorded for Round ${roundNumber}. ` +
                  `If you win, you receive ${potentialPayout} ETB.`
                : `Your Round ${roundNumber} bid was raised to ${dto.bid_amount} ETB. ` +
                  `If you win, you receive ${potentialPayout} ETB.`,
        };
    }

    /**
     * Lists every bid for a round, highest first — the auction leaderboard.
     */
    async listRoundBids(
        equbId: string,
        roundNumber: number,
    ): Promise<{ items: any[]; total: number; round_number: number }> {
        const items = await this.repo.getRoundBids(equbId, roundNumber);
        return { items, total: items.length, round_number: roundNumber };
    }

    /**
     * Resolves the current round's auction: the highest bidder wins the pot
     * minus their bid (P_winner = V_base − B_r), and the bid is marked for
     * redistribution. Idempotent per round — a second call replays the
     * existing winner instead of resolving twice.
     */
    async resolveRoundAuction(
        equbId: string,
        ctx: RlsContext,
    ): Promise<{
        round_number: number;
        winner: any;
        bid_amount: number;
        payout_amount: number;
        redistributed_share: number;
        total_bids: number;
        already_resolved: boolean;
        message: string;
    }> {
        const equb = await this.repo.getEqubRoundInfo(equbId);
        if (!equb) throw new NotFoundException('Equb group not found.');

        if (equb.status === 'cancelled') {
            throw new BadRequestException('This Equb has been cancelled.');
        }
        if (equb.status === 'completed') {
            throw new BadRequestException('This Equb has already completed all rounds.');
        }

        const roundNumber = equb.current_round;
        if (roundNumber < 1) {
            throw new BadRequestException(
                'This Equb has not started any rounds yet. Activate it first.',
            );
        }

        // Idempotency — if this round already has a winner, replay the result.
        const existingWinner = await this.repo.getWinningBid(equbId, roundNumber);
        if (existingWinner) {
            return {
                round_number: roundNumber,
                winner: {
                    id: existingWinner.user_id,
                    first_name: existingWinner.first_name ?? 'Unknown',
                    last_name: existingWinner.last_name ?? '',
                    phone: existingWinner.phone ?? '',
                },
                bid_amount: existingWinner.bid_amount,
                payout_amount: existingWinner.potential_payout,
                redistributed_share: parseFloat(
                    (
                        existingWinner.bid_amount / Math.max(1, await this.countBidders(equbId, roundNumber) - 1)
                    ).toFixed(2),
                ),
                total_bids: await this.countBidders(equbId, roundNumber),
                already_resolved: true,
                message:
                    `Round ${roundNumber} was already resolved. Winner: ` +
                    `${existingWinner.first_name ?? 'Unknown'} ${existingWinner.last_name ?? ''}.`,
            };
        }

        // Eligible bidder set = bids placed for this round (highest first).
        const bids = await this.repo.getRoundBids(equbId, roundNumber);
        if (bids.length === 0) {
            throw new UnprocessableEntityException(
                'No bids have been placed for this round — run a lottery draw instead.',
            );
        }

        // Highest bid wins; ties are broken by earliest submission.
        const winner = bids[0];
        const payoutAmount = parseFloat(
            (equb.total_amount - winner.bid_amount).toFixed(2),
        );

        await this.repo.resolveAuction(
            equbId,
            roundNumber,
            winner.user_id,
            payoutAmount,
            ctx,
        );

        // Advance to the next round (completes after the final round).
        await this.repo.advanceEqubRound(equbId, ctx);

        const redistributedShare = parseFloat(
            (winner.bid_amount / Math.max(1, bids.length - 1)).toFixed(2),
        );

        this.logger.log(
            `Auction resolved: equb=${equbId} round=${roundNumber} winner=${winner.user_id} bid=${winner.bid_amount}`,
        );

        return {
            round_number: roundNumber,
            winner: {
                id: winner.user_id,
                first_name: winner.first_name ?? 'Unknown',
                last_name: winner.last_name ?? '',
                phone: winner.phone ?? '',
            },
            bid_amount: winner.bid_amount,
            payout_amount: payoutAmount,
            redistributed_share: redistributedShare,
            total_bids: bids.length,
            already_resolved: false,
            message:
                `${winner.first_name ?? 'Unknown'} ${winner.last_name ?? ''} won the ` +
                `Round ${roundNumber} auction with a bid of ${winner.bid_amount} ETB ` +
                `and receives ${payoutAmount} ETB.`,
        };
    }

    private async countBidders(equbId: string, roundNumber: number): Promise<number> {
        const bids = await this.repo.getRoundBids(equbId, roundNumber);
        return bids.length;
    }

    // ── Get Pending Payments ──────────────────────────────────────────────────

    async getPendingPayments(
        equbId: string,
        roundNumber: number,
    ): Promise<PaymentRecord[]> {
        return this.repo.getPendingPaymentsForRound(equbId, roundNumber);
    }

    // ── Lottery Draw (spec §4) ────────────────────────────────────────────────

    /**
     * Runs a lottery draw for the equb's CURRENT round using Node's OS-level
     * CSPRNG (crypto.randomInt).
     *
     * The ENTIRE spin — cycle lock, eligibility, prior-winner exclusion,
     * winner write, immutable event, payout, and round advance — executes
     * inside ONE strict PostgreSQL transaction. Any failure rolls the whole
     * operation back, leaving no partial state.
     *
     * Concurrency: the equb row is locked FOR UPDATE, so two simultaneous
     * spins on the same equb serialize; the second sees the first's
     * committed/advanced round and is idempotent (it replays the existing
     * draw) rather than drawing twice.
     *
     * Returns the winner + the full candidate list so the client can animate
     * a transparent spinning wheel that lands on the actual winner.
     */
    async runLotteryDraw(
        equbId: string,
        ctx: RlsContext,
    ): Promise<{
        draw: { id: string; equb_id: string; round_number: number; winner_id: string; draw_timestamp: string };
        winner: LotteryCandidate;
        candidates: LotteryCandidate[];
        message: string;
    }> {
        return inTransaction(ctx, async (tx) => {
            // (1) Lock + verify the active cycle. FOR UPDATE serializes
            //     concurrent spins on the same equb at the database level.
            const equb = await this.repo.lockEqubCycleForUpdate(equbId, tx);
            if (!equb) throw new NotFoundException('Equb group not found.');

            if (equb.status === 'cancelled') {
                throw new BadRequestException('This Equb has been cancelled.');
            }
            if (equb.status === 'completed') {
                throw new BadRequestException('This Equb has already completed all rounds.');
            }

            const roundNumber = equb.current_round;
            if (roundNumber < 1) {
                throw new BadRequestException(
                    'This Equb has not started any rounds yet. Activate it first.',
                );
            }

            // (2) Idempotency — if a concurrent spin already drew this round,
            //     replay the committed result instead of drawing twice.
            const existing = await this.repo.getExistingDrawInTx(equbId, roundNumber, tx);
            if (existing) {
                const candidates = await this.repo.getEligibleCandidatesForSpinRound(
                    equbId, roundNumber, tx,
                );
                const winner = candidates.find((c) => c.id === existing.winner_id)
                    ?? await this.getCandidateById(equbId, roundNumber, existing.winner_id);
                return {
                    draw: {
                        id: existing.id,
                        equb_id: existing.equb_id,
                        round_number: existing.round_number,
                        winner_id: existing.winner_id,
                        draw_timestamp: existing.draw_timestamp.toISOString(),
                    },
                    winner,
                    candidates,
                    message: `Round ${roundNumber} was already drawn. Winner: ${winner?.first_name ?? 'Unknown'} ${winner?.last_name ?? ''}.`,
                };
            }

            // (3) Eligibility + exclusion — approved, paid-for-this-round
            //     members who have NOT already won the current cycle.
            const candidates = await this.repo.getEligibleCandidatesForSpinRound(
                equbId, roundNumber, tx,
            );
            if (candidates.length === 0) {
                throw new UnprocessableEntityException(
                    'No eligible members for this round — nobody has paid yet, or every paying member has already won this cycle.',
                );
            }

            // (4) CSPRNG uniform winner selection (crypto.randomInt, never Math.random).
            const winnerIndex = crypto.randomInt(0, candidates.length);
            const winner = candidates[winnerIndex];

            // (5) Winner state update.
            await this.repo.markMembershipWonCycle(winner.membership_id, roundNumber, tx);

            // (6) Immutable lottery WIN event (append-only ledger).
            await this.repo.insertLotteryEvent(
                equbId,
                roundNumber,
                winner.membership_id,
                winner.id,
                'LOTTERY_WIN',
                ctx.userId,
                { candidate_count: candidates.length },
                tx,
            );

            const created = await this.repo.createLotteryDrawInTx(
                equbId,
                roundNumber,
                winner.id,
                null,
                tx,
            );

            // If the draw already existed (race condition), return the existing.
            const draw = created ?? (await this.repo.getExistingDrawInTx(equbId, roundNumber, tx));
            if (!draw) {
                throw new InternalServerErrorException('Failed to persist lottery draw.');
            }

            // (7) Record the payout + its immutable event so finance can release the pot.
            await this.repo.createPayoutInTx(
                equbId,
                roundNumber,
                winner.id,
                equb.contribution_amount * Math.max(1, candidates.length),
                tx,
            );
            await this.repo.insertLotteryEvent(
                equbId,
                roundNumber,
                winner.membership_id,
                winner.id,
                'PAYOUT_SCHEDULED',
                ctx.userId,
                { pot_amount: equb.contribution_amount * Math.max(1, candidates.length) },
                tx,
            );

            // (8) Advance to the next round (completes after the final round).
            await this.repo.advanceEqubRoundInTx(equbId, tx);

            this.logger.log(
                `Lottery draw committed: equb=${equbId} round=${roundNumber} winner=${winner.id}`,
            );

            return {
                draw: {
                    id: draw.id,
                    equb_id: draw.equb_id,
                    round_number: draw.round_number,
                    winner_id: draw.winner_id,
                    draw_timestamp: draw.draw_timestamp.toISOString(),
                },
                winner,
                candidates,
                message: `🎉 ${winner.first_name} ${winner.last_name} won the Round ${roundNumber} pot!`,
            };
        });
    }

    /** Lists all draws for an equb with winner details. */
    async listLotteryDraws(equbId: string) {
        const equb = await this.repo.getEqubRoundInfo(equbId);
        if (!equb) throw new NotFoundException('Equb group not found.');

        const items = await this.repo.getLotteryDraws(equbId);
        const latest = items[0] ?? null;

        let latest_draw: {
            draw: { id: string; equb_id: string; round_number: number; winner_id: string; draw_timestamp: string };
            winner: LotteryCandidate;
            candidates: LotteryCandidate[];
        } | null = null;
        if (latest) {
            const winner = await this.getCandidateById(equbId, latest.round_number, latest.winner_id);
            latest_draw = {
                draw: {
                    id: latest.id,
                    equb_id: equbId,
                    round_number: latest.round_number,
                    winner_id: latest.winner_id,
                    draw_timestamp: latest.draw_timestamp.toISOString(),
                },
                winner,
                candidates: await this.repo.getEligibleMembersForDraw(equbId, latest.round_number),
            };
        }

        return {
            items,
            total: items.length,
            current_round: equb.current_round,
            total_rounds: equb.total_rounds,
            latest_draw,
        };
    }

    // ── User-facing lottery (spec §4 — member dashboard, READ-ONLY) ────────────

    /**
     * Returns the authenticated member's current lottery view: the active
     * cycle, the user's OWN eligibility computed from real database state
     * (approved membership + paid contribution + not-yet-won), and the latest
     * public winner. The UI must NOT recompute any of this — it is backend
     * authoritative.
     */
    async getLotteryCurrent(
        equbId: string,
        userId: string,
    ): Promise<UserLotteryCurrentResponse> {
        const overview = await this.repo.getUserCycleOverview(equbId, userId);
        if (!overview) throw new NotFoundException('Equb group not found.');

        const paid = overview.payment_status === 'paid' || overview.payment_status === 'auto_debited';
        const approved = overview.membership_status === 'approved';
        const won = overview.won_current_cycle === true;
        const eligible = approved && paid && !won;

        let message: string;
        if (approved && won) {
            message = 'Not eligible for another win this cycle.';
        } else if (approved && paid) {
            message = 'Eligible for the next draw.';
        } else if (approved && !paid) {
            message = 'Contribution for this cycle is not yet paid.';
        } else {
            message = 'Only approved, paid members are eligible.';
        }

        const latestWinner = await this.repo.getLatestPublicWinner(equbId);

        return {
            cycle: {
                number: overview.current_round,
                total_rounds: overview.total_rounds,
                status: overview.status,
                started_at: overview.created_at?.toISOString?.() ?? overview.created_at,
                updated_at: overview.updated_at?.toISOString?.() ?? overview.updated_at,
                is_active: overview.status === 'open' || overview.status === 'active',
            },
            eligibility: {
                contribution: paid ? 'paid' : 'unpaid',
                eligible,
                won,
                message,
            },
            latestWinner: latestWinner ? this.toPublicWinner(latestWinner) : null,
        };
    }

    /**
     * Returns the paginated PUBLIC lottery history for an equb. Only
     * intentionally-public winner fields are exposed (display name + draw
     * time); no phone/email/wallet/internal ids are ever included.
     */
    async getPublicLotteryHistory(
        equbId: string,
        page = 1,
        limit = 10,
    ): Promise<UserLotteryHistoryResponse> {
        const equb = await this.repo.getEqubRoundInfo(equbId);
        if (!equb) throw new NotFoundException('Equb group not found.');

        const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
        const safePage = Math.max(Math.floor(page), 1);
        const offset = (safePage - 1) * safeLimit;

        const [items, total] = await Promise.all([
            this.repo.getPublicLotteryHistory(equbId, safeLimit, offset),
            this.repo.countPublicLotteryWins(equbId),
        ]);

        return {
            items: items.map((r) => this.toPublicWinner(r)),
            total,
            page: safePage,
            limit: safeLimit,
            total_pages: Math.ceil(total / safeLimit),
        };
    }

    /**
     * Reduces a public win row to the response shape that carries ONLY the
     * display name (first name + last-name initial) plus draw meta. Defensive
     * projection: no sensitive fields ever leave the service.
     */
    private toPublicWinner(record: PublicWinnerRecord): UserLotteryHistoryItem {
        return {
            cycle: record.round_number,
            winner: {
                displayName: this.toDisplayName(record.first_name, record.last_name),
            },
            drawnAt: record.draw_timestamp?.toISOString?.() ?? record.draw_timestamp,
        };
    }

    /** "Dawit A." — first name + last-name initial (falls back gracefully). */
    private toDisplayName(firstName: string, lastName: string): string {
        const first = (firstName ?? '').trim() || 'Member';
        const initial = (lastName ?? '').trim().charAt(0).toUpperCase();
        return initial ? `${first} ${initial}.` : first;
    }

    private async getCandidateById(
        equbId: string,
        roundNumber: number,
        winnerId: string,
    ): Promise<LotteryCandidate> {
        const candidates = await this.repo.getEligibleMembersForDraw(equbId, roundNumber);
        const found = candidates.find((c) => c.id === winnerId);
        if (found) return found;

        // Winner was eligible at draw time but may no longer be in the current
        // eligible set (e.g. membership revoked later) — still resolve their name.
        const sql = getPool();
        const rows = await sql<LotteryCandidate[]>`
      SELECT id, first_name, last_name, phone
      FROM users
      WHERE id = ${winnerId}
      LIMIT 1
    `;
        if (!rows[0]) {
            throw new InternalServerErrorException('Winner record not found.');
        }
        return rows[0];
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async getOrCreatePendingPaymentId(
        userId: string,
        equbId: string,
        round: number,
        amount: number,
        feeDeducted: number,
        hostCommissionDeducted: number,
        provider: string,
        ctx: RlsContext,
    ): Promise<string> {
        const existing = await this.repo.findPendingPayment(userId, equbId, round);
        if (existing) return existing.id;

        const created = await this.repo.createPendingPayment(
            userId, equbId, round, amount,
            feeDeducted, hostCommissionDeducted, provider, ctx,
        );
        return created.id;
    }

    private async verifyWebhookSignature(
        processor: string,
        rawBody: Buffer,
        signature: string,
    ): Promise<void> {
        if (this.providerService) {
            const provider: PaymentProvider = this.providerService.resolve(
                processor as 'chapa' | 'telebirr',
            );
            await provider.verifyWebhookSignature(rawBody, signature);
            return;
        }

        const secrets = await VaultConfig.load();

        if (processor === 'chapa') {
            const expected = crypto
                .createHmac('sha256', secrets.CHAPA_SECRET_KEY)
                .update(rawBody)
                .digest('hex');

            if (expected !== signature) {
                throw new BadRequestException('Invalid Chapa webhook signature.');
            }
        }

        if (processor === 'telebirr') {
            const expected = crypto
                .createHmac('sha256', secrets.TELEBIRR_APP_SECRET)
                .update(rawBody)
                .digest('hex');

            if (expected !== signature) {
                throw new BadRequestException('Invalid Telebirr webhook signature.');
            }
        }
    }
}
