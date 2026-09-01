/**
 * weekly-reminder.task.ts
 *
 * Dispatches weekly payment-window reminders to members of weekly equbs.
 *
 * For each active weekly equb the window runs on the 6 days before its cutoff
 * weekday (Day 7). Reminders are sent per the spec:
 *
 *   Day 1 (window open)  → "Window open"        (6 days before the draw)
 *   Day 4 (mid-week)     → "Mid-week reminder"  (3 days before the draw)
 *   Day 6 (final call)   → "Final call"         (1 day before the draw)
 *
 * This cron runs once daily so a reminder is sent at most once per equb per
 * day. It only reads cadence-agnostic state and writes notification rows — no
 * wallet / payment mutations, so a Redlock guard is optional and not required
 * for correctness at the daily cadence.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { WeeklyCycleService } from './weekly-cycle.service';
import { WeeklyCycleRepository, WeeklyEqubRecord } from './weekly-cycle.repository';

@Injectable()
export class WeeklyReminderTask {
    private readonly logger = new Logger(WeeklyReminderTask.name);

    constructor(
        private readonly repo: WeeklyCycleRepository,
        private readonly service: WeeklyCycleService,
    ) {}

    // Run once per day in the morning (local server time).
    @Cron('0 8 * * *', { name: 'weekly-reminder-task' })
    async runDailyReminders(): Promise<void> {
        const equbs = await this.repo.listActiveWeeklyEqubs();
        for (const equb of equbs) {
            try {
                await this.notifyDueMembers(equb);
            } catch (err) {
                this.logger.error(
                    `Weekly reminder failed for equb ${equb.id}: ${(err as Error).message}`,
                );
            }
        }
    }

    private async notifyDueMembers(equb: WeeklyEqubRecord): Promise<void> {
        const cycle = await this.repo.getOpenCycle(equb.id);
        if (!cycle) return;
        if (cycle.status !== 'open') return;

        const daysUntilDraw = this.daysUntil(
            this.toDate(cycle.cycle_date),
            new Date(),
        );
        if (![6, 3, 1].includes(daysUntilDraw)) return; // not a reminder day

        const isFinalCall = daysUntilDraw === 1;
        const isMidWeek = daysUntilDraw === 3;
        const title = isFinalCall
            ? 'Final call — Equb contribution due'
            : isMidWeek
              ? 'Mid-week reminder — Equb contribution'
              : 'Equb payment window is open';

        const body = isFinalCall
            ? `This is the last day to pay ${equb.contribution_amount.toFixed(2)} ETB ` +
              `for "${equb.name}". Pay before today's cutoff to stay eligible for this week's draw.`
            : isMidWeek
              ? `Reminder: pay your weekly ${equb.contribution_amount.toFixed(2)} ETB ` +
                `share for "${equb.name}". You have until the weekly cutoff to avoid a late penalty.`
              : `The payment window for "${equb.name}" is now open. Deposit your weekly ` +
                `${equb.contribution_amount.toFixed(2)} ETB share before the cutoff to join this week's draw.`;

        const members = await this.repo.listApprovedMemberIds(equb.id);
        for (const userId of members) {
            try {
                await this.service.sendReminder(userId, title, body, equb);
            } catch (err) {
                this.logger.warn(
                    `Failed to send weekly reminder to user ${userId}: ${(err as Error).message}`,
                );
            }
        }
    }

    private daysUntil(from: Date, to: Date): number {
        const msPerDay = 24 * 60 * 60 * 1000;
        const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
        return Math.round((a.getTime() - b.getTime()) / msPerDay);
    }

    private toDate(dateStr: string): Date {
        const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10));
        return new Date(y, (m || 1) - 1, d || 1);
    }
}
