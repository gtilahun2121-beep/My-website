/**
 * debit.task.ts
 *
 * Scheduled cron — runs every day at 08:00 UTC (11:00 EAT).
 * Processes auto-debit for all active Equb groups.
 *
 * Per-payment pipeline:
 *  (1) Acquire Redis Redlock         — prevents duplicate runs across pods
 *  (2) Open ACID transaction         — with RLS context
 *  (3) SELECT ... FOR UPDATE         — locks the payment row
 *  (4) Verify status == 'pending'    — skip if already processed
 *  (5a) Wallet sufficient            — deduct + mark auto_debited + route fees
 *  (5b) Wallet insufficient + token  — trigger bank auto-debit API fallback
 *  (5c) Neither                      — mark failed
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import Redlock from 'redlock';
import Redis from 'ioredis';

import { PaymentsRepository } from '../payments.repository';
import { inTransaction, getPool } from '../../../config/database.config';

const LOCK_PREFIX = 'lock:payment:';
const LOCK_TTL_MS = 30_000;

@Injectable()
export class DebitTask implements OnModuleInit {
    private readonly logger = new Logger(DebitTask.name);
    private redlock!: Redlock;

    constructor(private readonly repo: PaymentsRepository) { }

    onModuleInit(): void {
        const redis = new Redis(
            process.env.REDIS_URL ?? 'redis://localhost:6379',
            {
                enableReadyCheck: false,   // don't throw if Redis isn't ready
                maxRetriesPerRequest: null, // let Redlock handle retries
                lazyConnect: true,          // don't connect until first command
            },
        );

        // Suppress unhandled error events — ioredis emits these when Redis
        // is unavailable. Without this listener Node.js crashes the process.
        redis.on('error', (err: Error) => {
            this.logger.warn(`[Redis] Connection error (debit-task): ${err.message}`);
        });

        this.redlock = new Redlock([redis as unknown as Redlock.CompatibleRedisClient], {
            retryCount: 3,
            retryDelay: 300,
            retryJitter: 100,
        });

        this.logger.log('DebitTask Redlock initialised.');
    }

    // ── Cron trigger ─────────────────────────────────────────────────────────

    @Cron('0 8 * * *', { name: 'auto-debit-task', timeZone: 'UTC' })
    async runAutoDebit(): Promise<void> {
        this.logger.log('Auto-debit task started.');

        const sql = getPool();

        const activeEqubs = await sql<{
            id: string;
            host_id: string;
            current_round: number;
            contribution_amount: number;
        }[]>`
      SELECT id, host_id, current_round, contribution_amount
      FROM equb_groups
      WHERE status        = 'active'
        AND current_round > 0
    `;

        if (activeEqubs.length === 0) {
            this.logger.log('No active equbs — auto-debit skipped.');
            return;
        }

        for (const equb of activeEqubs) {
            await this.processEqubAutoDebit(equb);
        }

        this.logger.log('Auto-debit task completed.');
    }

    // ── Per-Equb pipeline ─────────────────────────────────────────────────────

    private async processEqubAutoDebit(equb: {
        id: string;
        host_id: string;
        current_round: number;
        contribution_amount: number;
    }): Promise<void> {

        const members = await this.repo.getMembersWithAutoDebit(equb.id);

        for (const member of members) {
            const lockKey = `${LOCK_PREFIX}${member.user_id}:${equb.id}:${equb.current_round}`;
            let lock: Redlock.Lock | null = null;

            try {
                // (1) Acquire Redlock — skip member if already being processed
                lock = await this.redlock.lock(lockKey, LOCK_TTL_MS);

                // (2) Open ACID transaction with RLS context
                await inTransaction(
                    { userId: member.user_id, userRole: 'participant' },
                    async (tx) => {

                        // (3) Find and lock the pending payment row
                        const pendingPayment = await this.repo.findPendingPayment(
                            member.user_id,
                            equb.id,
                            equb.current_round,
                        );

                        if (!pendingPayment || pendingPayment.payment_status !== 'pending') {
                            return; // Already paid or no record — skip
                        }

                        const locked = await this.repo.lockPaymentForUpdate(
                            pendingPayment.id,
                            tx,
                        );

                        // (4) Re-verify after lock — race condition guard
                        if (!locked || locked.payment_status !== 'pending') {
                            return;
                        }

                        // (5a) Try wallet first
                        const walletDeducted = await this.repo.deductWalletBalance(
                            member.user_id,
                            equb.contribution_amount,
                            tx,
                        );

                        if (walletDeducted) {
                            const txRef = `AUTODEBIT-WLT-${uuidv4()}`;
                            await this.repo.markPaymentAutoDebited(pendingPayment.id, txRef, tx);

                            // Route fees
                            await this.repo.creditWalletBalance(
                                equb.host_id,
                                pendingPayment.host_commission_deducted,
                                tx,
                            );
                            const adminId = await this.repo.getAdminWalletUserId();
                            if (adminId) {
                                await this.repo.creditWalletBalance(
                                    adminId,
                                    pendingPayment.fee_deducted,
                                    tx,
                                );
                            }

                            this.logger.log(
                                `Auto-debit wallet OK: user=${member.user_id} equb=${equb.id} round=${equb.current_round}`,
                            );
                            return;
                        }

                        // (5b) Insufficient wallet — try bank token fallback
                        if (member.auto_debit_token) {
                            const txRef = await this.triggerBankAutoDebit(
                                member.auto_debit_token,
                                equb.contribution_amount,
                                member.user_id,
                            );

                            if (txRef) {
                                await this.repo.markPaymentAutoDebited(pendingPayment.id, txRef, tx);
                                this.logger.log(
                                    `Auto-debit bank OK: user=${member.user_id} txRef=${txRef}`,
                                );
                            } else {
                                await this.repo.markPaymentFailed(pendingPayment.id, tx);
                                this.logger.warn(
                                    `Auto-debit bank FAILED: user=${member.user_id} equb=${equb.id}`,
                                );
                            }
                            return;
                        }

                        // (5c) No fallback — mark failed
                        await this.repo.markPaymentFailed(pendingPayment.id, tx);
                        this.logger.warn(
                            `Auto-debit FAILED: user=${member.user_id} — insufficient balance, no bank token.`,
                        );
                    },
                );

            } catch (err: unknown) {
                this.logger.error(
                    `Auto-debit error for user=${member.user_id}: ${(err as Error).message}`,
                );
            } finally {
                if (lock) {
                    await lock.unlock().catch((e: Error) =>
                        this.logger.warn('Failed to release Redlock:', e),
                    );
                }
            }
        }
    }

    // ── Bank API stub ─────────────────────────────────────────────────────────

    /**
     * Calls Telebirr / CBE Birr B2C API using the member's stored consent token.
     * Returns a transaction reference on success, null on failure.
     *
     * TODO: Replace stub with real B2C API implementation.
     */
    private async triggerBankAutoDebit(
        autoDebitToken: string,
        amount: number,
        userId: string,
    ): Promise<string | null> {
        try {
            this.logger.debug(
                `[STUB] Bank auto-debit: token=${autoDebitToken} amount=${amount} user=${userId}`,
            );
            return `BANK-${uuidv4()}`;
        } catch (err: unknown) {
            this.logger.error('Bank auto-debit API error:', err);
            return null;
        }
    }
}
