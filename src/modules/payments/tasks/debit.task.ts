/**
 * debit.task.ts
 *
 * Scheduled cron task that runs the auto-debit pipeline for all active
 * Equb groups. Triggered by @nestjs/schedule every day at 08:00 AM EAT.
 *
 * Per-payment execution also uses the full double-payment prevention
 * pipeline (Redis Redlock + SELECT FOR UPDATE) so no member is ever
 * charged twice even if the cron fires multiple times.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import Redlock from 'redlock';
import Redis from 'ioredis';

import { PaymentsRepository } from '../payments.repository';
import { inTransaction, getPool } from '../../../config/database.config';

const LOCK_PREFIX = 'lock:payment:';
const LOCK_TTL_MS = 30_000;

@Injectable()
export class DebitTask {
    private readonly logger = new Logger(DebitTask.name);
    private redlock: Redlock;

    constructor(private readonly repo: PaymentsRepository) {
        const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

        this.redlock = new Redlock([redis], {
            retryCount: 3,
            retryDelay: 300,
            retryJitter: 100,
        });
    }

    /**
     * Runs every day at 08:00 AM UTC (11:00 AM EAT).
     * Iterates all active equbs and processes auto-debit for members
     * with consent who have a pending payment for the current round.
     */
    @Cron('0 8 * * *', { name: 'auto-debit-task', timeZone: 'UTC' })
    async runAutoDebit(): Promise<void> {
        this.logger.log('Auto-debit task started.');

        const sql = getPool();

        // Fetch all active equbs that have a current round in progress
        const activeEqubs = await sql<{
            id: string;
            host_id: string;
            current_round: number;
            contribution_amount: number;
        }[]>`
      SELECT id, host_id, current_round, contribution_amount
      FROM equb_groups
      WHERE status = 'active'
        AND current_round > 0
    `;

        if (activeEqubs.length === 0) {
            this.logger.log('No active equbs found. Auto-debit skipped.');
            return;
        }

        for (const equb of activeEqubs) {
            await this.processEqubAutoDebit(equb);
        }

        this.logger.log('Auto-debit task completed.');
    }

    // ── Per-Equb Auto-Debit ───────────────────────────────────────────────────

    private async processEqubAutoDebit(equb: {
        id: string;
        host_id: string;
        current_round: number;
        contribution_amount: number;
    }): Promise<void> {

        // Get all consenting members with pending payments this round
        const members = await this.repo.getMembersWithAutoDebit(equb.id);
        const feeConfig = await this.repo.getActiveFeeConfig();

        for (const member of members) {
            const lockKey = `${LOCK_PREFIX}${member.user_id}:${equb.id}:${equb.current_round}`;

            let lock: Awaited<ReturnType<typeof this.redlock.acquire>> | null = null;

            try {
                // Acquire Redlock — skip member if already being processed
                lock = await this.redlock.acquire([lockKey], LOCK_TTL_MS);

                await inTransaction(
                    { userId: member.user_id, userRole: 'participant' },
                    async (tx) => {
                        // Find and lock the pending payment row
                        const pendingPayment = await this.repo.findPendingPayment(
                            member.user_id,
                            equb.id,
                            equb.current_round,
                        );

                        if (!pendingPayment || pendingPayment.payment_status !== 'pending') {
                            return; // Already paid or no payment record — skip
                        }

                        const locked = await this.repo.lockPaymentForUpdate(pendingPayment.id, tx);
                        if (!locked || locked.payment_status !== 'pending') {
                            return; // Race condition — another process handled it
                        }

                        // Attempt wallet deduction first
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
                                await this.repo.creditWalletBalance(adminId, pendingPayment.fee_deducted, tx);
                            }

                            this.logger.log(
                                `Auto-debit wallet success: user=${member.user_id} equb=${equb.id} round=${equb.current_round}`,
                            );
                        } else if (member.auto_debit_token) {
                            // Fallback: trigger bank API auto-debit via stored token
                            const txRef = await this.triggerBankAutoDebit(
                                member.auto_debit_token,
                                equb.contribution_amount,
                                member.user_id,
                            );

                            if (txRef) {
                                await this.repo.markPaymentAutoDebited(pendingPayment.id, txRef, tx);
                                this.logger.log(
                                    `Auto-debit bank success: user=${member.user_id} equb=${equb.id} txRef=${txRef}`,
                                );
                            } else {
                                await this.repo.markPaymentFailed(pendingPayment.id, tx);
                                this.logger.warn(
                                    `Auto-debit failed: user=${member.user_id} equb=${equb.id} — bank API rejected.`,
                                );
                            }
                        } else {
                            await this.repo.markPaymentFailed(pendingPayment.id, tx);
                            this.logger.warn(
                                `Auto-debit failed: user=${member.user_id} — insufficient balance, no bank token.`,
                            );
                        }
                    },
                );

            } catch (err) {
                this.logger.error(
                    `Auto-debit error for user=${member.user_id}: ${(err as Error).message}`,
                );
            } finally {
                if (lock) {
                    await lock.release().catch((e) =>
                        this.logger.warn('Failed to release Redlock in debit task:', e),
                    );
                }
            }
        }
    }

    // ── Bank API Integration Stub ─────────────────────────────────────────────

    /**
     * Triggers a bank auto-debit using the member's stored consent token.
     * Returns a transaction reference string on success, null on failure.
     *
     * TODO: Replace stub with real Telebirr / CBE Birr B2C API call.
     */
    private async triggerBankAutoDebit(
        autoDebitToken: string,
        amount: number,
        userId: string,
    ): Promise<string | null> {
        try {
            // Stub — real implementation calls Telebirr B2C or CBE Birr API
            this.logger.debug(
                `[STUB] Bank auto-debit: token=${autoDebitToken} amount=${amount} user=${userId}`,
            );
            return `BANK-${uuidv4()}`;
        } catch (err) {
            this.logger.error('Bank auto-debit API error:', err);
            return null;
        }
    }
}
