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
    Logger,
    NotFoundException,
    OnModuleInit,
    UnprocessableEntityException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Redlock from 'redlock';
import Redis from 'ioredis';
import * as crypto from 'crypto';

import {
    PaymentsRepository,
    PaymentRecord,
    FeeConfigRecord,
} from './payments.repository';
import { CheckoutDto, PaymentMethod } from './dto/checkout.dto';
import { WebhookDto, WebhookStatus } from './dto/webhook.dto';
import { BidDto } from './dto/bid.dto';
import { RlsContext, inTransaction, getPool } from '../../config/database.config';
import { VaultConfig } from '../../config/vault.config';

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

function calculateFees(amount: number, config: FeeConfigRecord): FeeSplit {
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

    constructor(private readonly repo: PaymentsRepository) { }

    onModuleInit(): void {
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

        const membership = await this.repo.getMembership(ctx.userId, dto.equb_id);
        if (!membership) {
            throw new BadRequestException('You are not a member of this Equb group.');
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
                feeConfig,
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
        feeConfig: FeeConfigRecord,
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
                    equb.contribution_amount, feeDeducted, hostCommissionDeducted, ctx,
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
                    const txRef = `WLT-${uuidv4()}`;
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

    // ── External Payment Init ─────────────────────────────────────────────────

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
            equb.contribution_amount, feeDeducted, hostCommissionDeducted, ctx,
        );

        const txRef = `${dto.payment_method.toUpperCase()}-${uuidv4()}`;

        const sql = getPool();
        await sql`
      UPDATE payments
      SET transaction_reference = ${txRef},
          updated_at             = NOW()
      WHERE id = ${paymentId}
    `;

        const checkoutUrl = dto.payment_method === PaymentMethod.CHAPA
            ? `https://checkout.chapa.co/checkout/payment/${txRef}`
            : `https://telebirr.et/checkout/${txRef}`;

        return {
            payment_id: paymentId,
            checkout_url: checkoutUrl,
            status: 'pending',
            message: 'Redirect the user to the checkout URL to complete payment.',
        };
    }

    // ── Webhook Ingestion (spec §2.1) ─────────────────────────────────────────

    async handleWebhook(
        dto: WebhookDto,
        rawBody: Buffer,
        signature: string,
    ): Promise<{ received: boolean }> {

        await this.verifyWebhookSignature(dto.processor, rawBody, signature);

        if (dto.status !== WebhookStatus.SUCCESS) {
            this.logger.warn(
                `Webhook non-success: ${dto.status} for ${dto.tx_ref}`,
            );
            return { received: true };
        }

        const payment = await this.repo.confirmPaymentByReference(
            dto.tx_ref,
            dto.processor,
        );

        if (!payment) {
            this.logger.log(`Webhook duplicate/unknown txRef: ${dto.tx_ref}`);
            return { received: true };
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

        this.logger.log(`Webhook confirmed: ${payment.id} via ${dto.processor}`);
        return { received: true };
    }

    // ── Bidding Auction (spec §3.4) ───────────────────────────────────────────

    async submitBid(
        dto: BidDto,
        ctx: RlsContext,
    ): Promise<{
        bid_recorded: boolean;
        potential_payout: number;
        message: string;
    }> {
        const equb = await this.repo.findEqubById(dto.equb_id);
        if (!equb) throw new NotFoundException('Equb group not found.');

        if (equb.status !== 'active') {
            throw new BadRequestException(
                'Bidding is only allowed on active Equb groups.',
            );
        }

        if (dto.bid_amount >= equb.total_amount) {
            throw new UnprocessableEntityException(
                `Bid (${dto.bid_amount} ETB) must be less than pot (${equb.total_amount} ETB).`,
            );
        }

        const potentialPayout = parseFloat(
            (equb.total_amount - dto.bid_amount).toFixed(2),
        );

        // Store bid in audit_logs for Admin review
        const sql = getPool();
        await sql`
      INSERT INTO audit_logs (table_name, action, row_id, new_values, performed_by)
      VALUES (
        'equb_bids',
        'BID_SUBMITTED',
        gen_random_uuid(),
        ${JSON.stringify({
            equb_id: dto.equb_id,
            user_id: ctx.userId,
            bid_amount: dto.bid_amount,
            pot_value: equb.total_amount,
        })}::jsonb,
        ${ctx.userId}::uuid
      )
    `;

        return {
            bid_recorded: true,
            potential_payout: potentialPayout,
            message:
                `Bid of ${dto.bid_amount} ETB recorded. ` +
                `If you win, you receive ${potentialPayout} ETB.`,
        };
    }

    // ── Get Pending Payments ──────────────────────────────────────────────────

    async getPendingPayments(
        equbId: string,
        roundNumber: number,
    ): Promise<PaymentRecord[]> {
        return this.repo.getPendingPaymentsForRound(equbId, roundNumber);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async getOrCreatePendingPaymentId(
        userId: string,
        equbId: string,
        round: number,
        amount: number,
        feeDeducted: number,
        hostCommissionDeducted: number,
        ctx: RlsContext,
    ): Promise<string> {
        const existing = await this.repo.findPendingPayment(userId, equbId, round);
        if (existing) return existing.id;

        const created = await this.repo.createPendingPayment(
            userId, equbId, round, amount,
            feeDeducted, hostCommissionDeducted, ctx,
        );
        return created.id;
    }

    private async verifyWebhookSignature(
        processor: string,
        rawBody: Buffer,
        signature: string,
    ): Promise<void> {
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
