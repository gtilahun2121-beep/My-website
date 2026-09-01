/**
 * weekly-cycle.service.ts
 *
 * Business logic for the Weekly Equb engine. A single weekly run (normally
 * triggered by the WeeklyCycleTask cron on the equb's payment_cutoff_weekday at
 * payment_cutoff_time) mirrors the Daily Equb flow but with a 7-day period:
 *
 *   1. Open the current week's cycle (one row per operating week, dated by its
 *      draw/cutoff day — Day 7).
 *   2. At the weekly cutoff, close the window and apply a late-payment penalty
 *      to every approved member who did not record a paid/auto-debited
 *      contribution for the week. Late members are locked out of that week's
 *      draw only (they may pay and draw again next week).
 *   3. Run the automatic lottery draw for the week's round (reusing the
 *      existing transparent draw engine). If nobody paid, the draw is skipped
 *      AND the round is intentionally NOT advanced — the next week retries the
 *      same round before the equb can rotate.
 *   4. Open the following week's cycle.
 *
 * The "Prime Option" (የእጣ ግዢ) auction/bid track is provided by the existing
 * auction module — the weekly engine runs the standard lottery draw, and hosts
 * may opt to resolve via auction instead through the existing endpoints.
 *
 * All wallet mutations run in the admin RLS context because wallets are
 * RLS-protected and a system task must debit any member's wallet.
 */

import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import {
    WeeklyCycleRepository,
    WeeklyEqubRecord,
    WeeklyCycleRecord,
} from './weekly-cycle.repository';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { inTransaction, RlsContext } from '../../config/database.config';

@Injectable()
export class WeeklyCycleService {
    private readonly logger = new Logger(WeeklyCycleService.name);

    constructor(
        private readonly repo: WeeklyCycleRepository,
        private readonly payments: PaymentsService,
        private readonly notifications: NotificationsRepository,
    ) {}

    /** Local YYYY-MM-DD for a given date. */
    private dateString(now: Date = new Date()): string {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Returns the date of this week's cutoff day (Day 7) — the date on which
     * the open weekly window closes and the draw runs. If today IS the cutoff
     * day we return today (the current cycle's draw date).
     */
    private weekCutoffDate(equb: WeeklyEqubRecord, now: Date = new Date()): Date {
        const cutoffDate = new Date(now);
        const daysUntilCutoff =
            (equb.payment_cutoff_weekday - now.getDay() + 7) % 7;
        cutoffDate.setDate(now.getDate() + daysUntilCutoff);
        cutoffDate.setHours(0, 0, 0, 0);
        return cutoffDate;
    }

    /** Current state for a weekly equb (read model for the client). */
    async getState(equbId: string) {
        const equb = await this.repo.findWeeklyEqub(equbId);
        if (!equb) return null;
        if (!(await this.repo.isWeeklyEqub(equbId))) return null;

        const now = new Date();
        const cutoffDate = this.weekCutoffDate(equb, now);
        let cycle = await this.repo.getOpenCycle(equbId);
        if (!cycle) {
            cycle = await this.repo.openCycle(equbId, this.dateString(cutoffDate));
        }

        const windowOpen = await this.isPaymentWindowOpen(equb, now);

        return {
            equb_id: equb.id,
            name: equb.name,
            contribution_amount: equb.contribution_amount,
            current_round: equb.current_round,
            total_rounds: equb.total_rounds,
            payment_cutoff_time: equb.payment_cutoff_time,
            payment_cutoff_weekday: equb.payment_cutoff_weekday,
            late_penalty_rate: equb.late_penalty_rate,
            cycle_date: cycle.cycle_date,
            cycle_status: cycle.status,
            payment_window_open: windowOpen,
        };
    }

    /**
     * Weekly payment window: open during the 6 days before the cutoff weekday,
     * and on the cutoff weekday itself only up to payment_cutoff_time.
     */
    private async isPaymentWindowOpen(
        equb: WeeklyEqubRecord,
        now: Date = new Date(),
    ): Promise<boolean> {
        const [hh, mm] = equb.payment_cutoff_time
            .split(':')
            .map((s) => parseInt(s, 10));
        const daysSinceCutoff = (now.getDay() - equb.payment_cutoff_weekday + 7) % 7;
        if (daysSinceCutoff !== 0) return true;
        const cutoff = new Date(now);
        cutoff.setHours(hh ?? 17, mm ?? 0, 0, 0);
        return now < cutoff;
    }

    /**
     * Runs the weekly cutoff for every active weekly equb. This is the cron
     * entry point; individual equbs are processed independently so one
     * failure cannot stop the others.
     */
    async runAllWeeklyCutoffs(
        force = false,
    ): Promise<{ processed: number; results: unknown[] }> {
        const equbs = await this.repo.listActiveWeeklyEqubs();
        const results = [];
        for (const equb of equbs) {
            if (!force && !(await this.isCycleDue(equb))) continue;
            try {
                results.push(await this.runWeeklyCutoff(equb.id));
            } catch (err) {
                this.logger.error(
                    `Weekly cutoff failed for equb ${equb.id}: ${(err as Error).message}`,
                );
                results.push({ equb_id: equb.id, success: false, error: (err as Error).message });
            }
        }
        return { processed: results.length, results };
    }

    /**
     * A weekly equb is "due" when today is its cutoff weekday, the current
     * time has passed its cutoff time, and the open cycle has not yet been
     * drawn.
     */
    async isCycleDue(equb: WeeklyEqubRecord, now: Date = new Date()): Promise<boolean> {
        const openCycle = await this.repo.getOpenCycle(equb.id);
        if (!openCycle) return true; // nothing started this week → open + process
        if (openCycle.status === 'drawn') return false;

        if (now.getDay() !== equb.payment_cutoff_weekday) return false;
        const [hh, mm] = equb.payment_cutoff_time
            .split(':')
            .map((s) => parseInt(s, 10));
        const cutoff = new Date(now);
        cutoff.setHours(hh ?? 17, mm ?? 0, 0, 0);
        return now >= cutoff;
    }

    /**
     * End-to-end weekly close → penalty → draw → open-next for one equb.
     * Idempotent per cycle: if the week's cycle is already 'drawn' it returns
     * immediately.
     */
    async runWeeklyCutoff(equbId: string): Promise<{
        equb_id: string;
        success: boolean;
        cycle_date?: string;
        penalties_applied: number;
        draw?: unknown;
        message: string;
    }> {
        const equb = await this.repo.findWeeklyEqub(equbId);
        if (!equb) {
            return { equb_id: equbId, success: false, penalties_applied: 0, message: 'EQUBS_NOT_FOUND' };
        }
        if (!(await this.repo.isWeeklyEqub(equbId))) {
            return { equb_id: equbId, success: false, penalties_applied: 0, message: 'NOT_WEEKLY_EQUB' };
        }

        const cycleDate = this.weekCutoffDate(equb);
        let cycle = await this.repo.getOpenCycle(equbId);
        if (!cycle) cycle = await this.repo.openCycle(equbId, this.dateString(cycleDate));

        // Idempotency — a cycle that was already drawn is never re-run.
        if (cycle.status === 'drawn') {
            return {
                equb_id: equbId,
                success: true,
                cycle_date: cycle.cycle_date,
                penalties_applied: 0,
                message: `Weekly cycle ${cycle.cycle_date} already drawn.`,
            };
        }

        await this.repo.setCycleRound(cycle.id, equb.current_round);
        await this.repo.closeCycle(cycle.id);

        // 1) Late-payment penalties.
        const penaltiesApplied = await this.applyLatePenalties(equb, cycle);

        // 2) Automatic draw for the current round.
        let draw: unknown;
        try {
            draw = await this.payments.runLotteryDraw(equb.id, this.actorCtx(equb));
        } catch (err) {
            if (err instanceof UnprocessableEntityException) {
                this.logger.warn(
                    `Weekly draw skipped for equb ${equb.id}: no eligible paying members.`,
                );
                await this.openNextCycle(equbId, equb);
                return {
                    equb_id: equbId,
                    success: true,
                    cycle_date: cycle.cycle_date,
                    penalties_applied: penaltiesApplied,
                    draw: null,
                    message: 'Draw skipped — no eligible paying members. Round retained.',
                };
            }
            throw err;
        }

        await this.repo.markCycleDrawn(cycle.id);
        await this.openNextCycle(equbId, equb);

        this.logger.log(`Weekly cutoff complete: equb=${equbId} week=${cycle.cycle_date}`);
        return {
            equb_id: equbId,
            success: true,
            cycle_date: cycle.cycle_date,
            penalties_applied: penaltiesApplied,
            draw,
            message: 'Weekly cycle closed, penalties applied, draw completed.',
        };
    }

    private async applyLatePenalties(
        equb: WeeklyEqubRecord,
        cycle: WeeklyCycleRecord,
    ): Promise<number> {
        const unpaid = await this.repo.getApprovedMembersUnpaid(
            equb.id,
            equb.current_round,
        );
        if (unpaid.length === 0) return 0;

        const penaltyAmount = parseFloat(
            (equb.contribution_amount * equb.late_penalty_rate).toFixed(2),
        );

        const adminId = (await this.repo.getAdminId()) ?? equb.host_id;
        const adminCtx: RlsContext = { userId: adminId, userRole: 'admin' };

        const now = this.dateString(cycle.cycle_date ? new Date(cycle.cycle_date) : new Date());
        let applied = 0;

        for (const member of unpaid) {
            await this.repo.insertPenalty({
                equbId: equb.id,
                cycleId: cycle.id,
                userId: member.user_id,
                cycleDate: now,
                amount: penaltyAmount,
                reason: 'Missed weekly contribution cutoff',
            });

            const deducted = await inTransaction(adminCtx, async (tx) => {
                return this.repo.deductWalletPenalty(member.user_id, penaltyAmount, tx);
            });
            if (!deducted) {
                this.logger.warn(
                    `Late penalty not debited (insufficient wallet): user=${member.user_id} equb=${equb.id}`,
                );
            }

            await this.notifyLateMember(member.user_id, equb, penaltyAmount);
            applied++;
        }
        return applied;
    }

    private async openNextCycle(
        equbId: string,
        equb: WeeklyEqubRecord,
    ): Promise<void> {
        // Advance the recorded cycle date and open next week's window.
        const nextCutoff = this.weekCutoffDate(equb);
        nextCutoff.setDate(nextCutoff.getDate() + 7);
        await this.repo.setLastCycleDate(equbId, this.dateString());
        await this.repo.openCycle(equbId, this.dateString(nextCutoff));
    }

    private actorCtx(equb: WeeklyEqubRecord): RlsContext {
        return { userId: equb.host_id, userRole: 'host' };
    }

    /** Dispatches a payment-window reminder notification to a member. */
    async sendReminder(
        userId: string,
        title: string,
        body: string,
        equb: WeeklyEqubRecord,
    ): Promise<void> {
        await this.notifications.dispatch({
            user_id: userId,
            category: 'operational',
            title,
            body,
        });
        this.logger.debug(
            `Weekly reminder sent to ${userId} for equb ${equb.id}`,
        );
    }

    private async notifyLateMember(
        userId: string,
        equb: WeeklyEqubRecord,
        amount: number,
    ): Promise<void> {
        try {
            await this.notifications.dispatch({
                user_id: userId,
                category: 'system_policy',
                title: 'Missed Equb contribution',
                body: `You missed this week's contribution cutoff for "${equb.name}". ` +
                    `A late penalty of ${amount.toFixed(2)} ETB was applied and you are ` +
                    `locked out of this week's draw. Pay next week to resume eligibility.`,
            });
        } catch (err) {
            this.logger.warn(
                `Failed to notify late member ${userId}: ${(err as Error).message}`,
            );
        }
    }
}
