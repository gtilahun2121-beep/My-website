/**
 * daily-cycle.service.ts
 *
 * Business logic for the Daily Equb engine. A single daily run (normally
 * triggered by the DailyCycleTask cron at each equb's payment_cutoff_time):
 *
 *   1. Open the day's cycle (one row per operating day).
 *   2. At cutoff, close the window and apply a late-payment penalty to every
 *      approved member who did not record a paid/auto-debited contribution.
 *   3. Run the automatic lottery draw for the day's round (reusing the
 *      existing transparent draw engine). If nobody paid, the draw is skipped
 *      AND the round is intentionally NOT advanced — the next day retries the
 *      same round before the equb can rotate.
 *   4. Open the following day's cycle.
 *
 * All wallet mutations run in the admin RLS context because wallets are
 * RLS-protected and a system task must debit any member's wallet.
 */

import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import {
    DailyCycleRepository,
    DailyEqubRecord,
    DailyCycleRecord,
} from './daily-cycle.repository';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { inTransaction, RlsContext } from '../../config/database.config';

@Injectable()
export class DailyCycleService {
    private readonly logger = new Logger(DailyCycleService.name);

    constructor(
        private readonly repo: DailyCycleRepository,
        private readonly payments: PaymentsService,
        private readonly notifications: NotificationsRepository,
    ) {}

    /** Local YYYY-MM-DD for "today" as used by the run. */
    private todayString(now: Date = new Date()): string {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Ensures today's daily cycle row exists (open). Called on demand so the
     * frontend can always render the current window.
     */
    async ensureTodayCycle(equbId: string): Promise<DailyCycleRecord> {
        const cycle = await this.repo.getOpenCycle(equbId);
        if (cycle) return cycle;
        return this.repo.openCycle(equbId, this.todayString());
    }

    /** Current state for a daily equb (read model for the client). */
    async getState(equbId: string) {
        const equb = await this.repo.findDailyEqub(equbId);
        if (!equb) return null;

        const today = this.todayString();
        let cycle = await this.repo.getOpenCycle(equbId);
        if (!cycle) cycle = await this.repo.openCycle(equbId, today);

        const windowOpen = await this.repo.isPaymentWindowOpen(equbId);

        return {
            equb_id: equb.id,
            name: equb.name,
            contribution_amount: equb.contribution_amount,
            current_round: equb.current_round,
            total_rounds: equb.total_rounds,
            payment_cutoff_time: equb.payment_cutoff_time,
            late_penalty_rate: equb.late_penalty_rate,
            cycle_date: cycle.cycle_date,
            cycle_status: cycle.status,
            payment_window_open: windowOpen,
        };
    }

    /**
     * Runs the daily cutoff for every active daily equb. This is the cron
     * entry point; individual equbs are processed independently so one
     * failure cannot stop the others.
     */
    async runAllDailyCutoffs(
        force = false,
    ): Promise<{ processed: number; results: unknown[] }> {
        const equbs = await this.repo.listActiveDailyEqubs();
        const results = [];
        for (const equb of equbs) {
            if (!force && !(await this.isCycleDue(equb))) continue;
            try {
                results.push(await this.runDailyCutoff(equb.id));
            } catch (err) {
                this.logger.error(
                    `Daily cutoff failed for equb ${equb.id}: ${(err as Error).message}`,
                );
                results.push({ equb_id: equb.id, success: false, error: (err as Error).message });
            }
        }
        return { processed: results.length, results };
    }

    /**
     * A daily equb is "due" when the current local time has passed its cutoff
     * on today's date and the open cycle has not yet been drawn.
     */
    async isCycleDue(equb: DailyEqubRecord): Promise<boolean> {
        const openCycle = await this.repo.getOpenCycle(equb.id);
        if (!openCycle) return true; // nothing started today → open + process
        if (openCycle.status === 'drawn') return false;

        const now = new Date();
        const [hh, mm] = equb.payment_cutoff_time
            .split(':')
            .map((s) => parseInt(s, 10));
        const cutoff = new Date(now);
        cutoff.setHours(hh ?? 17, mm ?? 0, 0, 0);
        return now >= cutoff;
    }

    /**
     * End-to-end daily close → penalty → draw → open-next for one equb.
     * Idempotent per cycle: if the day's cycle is already 'drawn' it returns
     * immediately.
     */
    async runDailyCutoff(equbId: string): Promise<{
        equb_id: string;
        success: boolean;
        cycle_date?: string;
        penalties_applied: number;
        draw?: unknown;
        message: string;
    }> {
        const equb = await this.repo.findDailyEqub(equbId);
        if (!equb) {
            return { equb_id: equbId, success: false, penalties_applied: 0, message: 'EQUBS_NOT_FOUND' };
        }
        if (!(await this.repo.isDailyEqub(equbId))) {
            return { equb_id: equbId, success: false, penalties_applied: 0, message: 'NOT_DAILY_EQUB' };
        }

        const today = this.todayString();
        let cycle = await this.repo.getOpenCycle(equbId);
        if (!cycle) cycle = await this.repo.openCycle(equbId, today);

        // Idempotency — a cycle that was already drawn is never re-run.
        if (cycle.status === 'drawn') {
            return {
                equb_id: equbId,
                success: true,
                cycle_date: cycle.cycle_date,
                penalties_applied: 0,
                message: `Daily cycle ${cycle.cycle_date} already drawn.`,
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
                // Nobody paid → skip the draw and DO NOT advance the round.
                // The next day retries the same round.
                this.logger.warn(
                    `Daily draw skipped for equb ${equb.id}: no eligible paying members.`,
                );
                await this.openNextCycle(equbId, cycle, equb);
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
        await this.openNextCycle(equbId, cycle, equb);

        this.logger.log(`Daily cutoff complete: equb=${equbId} date=${cycle.cycle_date}`);
        return {
            equb_id: equbId,
            success: true,
            cycle_date: cycle.cycle_date,
            penalties_applied: penaltiesApplied,
            draw,
            message: 'Daily cycle closed, penalties applied, draw completed.',
        };
    }

    private async applyLatePenalties(
        equb: DailyEqubRecord,
        cycle: DailyCycleRecord,
    ): Promise<number> {
        const unpaid = await this.repo.getApprovedMembersUnpaid(
            equb.id,
            equb.current_round,
        );
        if (unpaid.length === 0) return 0;

        const penaltyAmount = parseFloat(
            (equb.contribution_amount * equb.late_penalty_rate).toFixed(2),
        );

        // Wallet mutation needs an RLS context that can write any member's
        // wallet — the admin role satisfies the wallet isolation policies.
        const adminId = (await this.repo.getAdminId()) ?? equb.host_id;
        const adminCtx: RlsContext = { userId: adminId, userRole: 'admin' };

        const now = this.todayString();
        let applied = 0;

        for (const member of unpaid) {
            await this.repo.insertPenalty({
                equbId: equb.id,
                cycleId: cycle.id,
                userId: member.user_id,
                cycleDate: now,
                amount: penaltyAmount,
                reason: 'Missed daily contribution cutoff',
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
        _cycle: DailyCycleRecord,
        equb: DailyEqubRecord,
    ): Promise<void> {
        // Advance the recorded cycle date and open tomorrow's window.
        const next = new Date();
        next.setDate(next.getDate() + 1);
        const nextDate = this.todayString(next);
        await this.repo.setLastCycleDate(equbId, this.todayString());
        await this.repo.openCycle(equbId, nextDate);
    }

    private actorCtx(equb: DailyEqubRecord): RlsContext {
        // Use the host as the acting user so the lottery event ledger records
        // a real authority; the draw only touches non-RLS tables plus the
        // event ledger, so a participant/host context is sufficient.
        return { userId: equb.host_id, userRole: 'host' };
    }

    private async notifyLateMember(
        userId: string,
        equb: DailyEqubRecord,
        amount: number,
    ): Promise<void> {
        try {
            await this.notifications.dispatch({
                user_id: userId,
                category: 'system_policy',
                title: 'Missed Equb contribution',
                body: `You missed today's contribution cutoff for "${equb.name}". ` +
                    `A late penalty of ${amount.toFixed(2)} ETB was applied. Pay before ` +
                    `tomorrow's cutoff to stay eligible for the draw.`,
            });
        } catch (err) {
            this.logger.warn(
                `Failed to notify late member ${userId}: ${(err as Error).message}`,
            );
        }
    }
}
