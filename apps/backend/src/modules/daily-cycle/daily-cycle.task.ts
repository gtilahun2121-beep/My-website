/**
 * daily-cycle.task.ts
 *
 * Scheduled task that runs the Daily Equb cutoff. Because each daily equb can
 * have its own payment_cutoff_time, the cron polls on a short interval and
 * processes only the equbs whose cutoff has passed AND whose open daily cycle
 * has not yet been drawn (see DailyCycleService.isCycleDue). Every close→
 * penalty→draw is idempotent per cycle and additionally guarded by a Redis
 * Redlock so concurrent ticks on multiple pods cannot double-process an equb.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redlock from 'redlock';
import Redis from 'ioredis';

import { DailyCycleService } from './daily-cycle.service';

const LOCK_KEY = 'lock:daily-cycle:global';
const LOCK_TTL_MS = 60_000;

@Injectable()
export class DailyCycleTask implements OnModuleInit {
    private readonly logger = new Logger(DailyCycleTask.name);
    private redlock!: Redlock;

    constructor(private readonly service: DailyCycleService) {}

    onModuleInit(): void {
        const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
        const isTls = redisUrl.startsWith('rediss://');

        const redis = new Redis(redisUrl, {
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            lazyConnect: true,
            tls: isTls ? {} : undefined,
        });

        redis.on('error', (err: Error) => {
            this.logger.warn(`[Redis] Connection error (daily-cycle): ${err.message}`);
        });

        this.redlock = new Redlock([redis as unknown as Redlock.CompatibleRedisClient], {
            retryCount: 3,
            retryDelay: 300,
            retryJitter: 100,
        });

        this.logger.log('DailyCycleTask Redlock initialised.');
    }

    // Poll every 5 minutes; individual equbs are processed only when due.
    @Cron(CronExpression.EVERY_5_MINUTES, { name: 'daily-cycle-task' })
    async runTick(): Promise<void> {
        let lock: Redlock.Lock | null = null;
        try {
            lock = await this.redlock.lock(LOCK_KEY, LOCK_TTL_MS);
        } catch {
            this.logger.warn('Daily-cycle tick skipped — another pod holds the lock.');
            return;
        }

        try {
            const result = await this.service.runAllDailyCutoffs(false);
            this.logger.log(`Daily-cycle tick processed ${result.processed} equb(s).`);
        } catch (err) {
            this.logger.error(`Daily-cycle tick failed: ${(err as Error).message}`);
        } finally {
            await lock.unlock().catch((e: Error) =>
                this.logger.warn('Failed to release daily-cycle Redlock:', e),
            );
        }
    }
}
