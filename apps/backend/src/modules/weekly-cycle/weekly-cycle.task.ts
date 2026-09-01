/**
 * weekly-cycle.task.ts
 *
 * Scheduled task that runs the Weekly Equb cutoff. Because each weekly equb
 * can have its own payment_cutoff_weekday and payment_cutoff_time, the cron
 * polls on a short interval and processes only the equbs whose cutoff has
 * passed AND whose open weekly cycle has not yet been drawn (see
 * WeeklyCycleService.isCycleDue). Every close→penalty→draw is idempotent per
 * cycle and additionally guarded by a Redis Redlock so concurrent ticks on
 * multiple pods cannot double-process an equb.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redlock from 'redlock';
import Redis from 'ioredis';

import { WeeklyCycleService } from './weekly-cycle.service';

const LOCK_KEY = 'lock:weekly-cycle:global';
const LOCK_TTL_MS = 60_000;

@Injectable()
export class WeeklyCycleTask implements OnModuleInit {
    private readonly logger = new Logger(WeeklyCycleTask.name);
    private redlock!: Redlock;

    constructor(private readonly service: WeeklyCycleService) {}

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
            this.logger.warn(`[Redis] Connection error (weekly-cycle): ${err.message}`);
        });

        this.redlock = new Redlock([redis as unknown as Redlock.CompatibleRedisClient], {
            retryCount: 3,
            retryDelay: 300,
            retryJitter: 100,
        });

        this.logger.log('WeeklyCycleTask Redlock initialised.');
    }

    // Poll every 10 minutes; individual equbs are processed only when due.
    @Cron(CronExpression.EVERY_10_MINUTES, { name: 'weekly-cycle-task' })
    async runTick(): Promise<void> {
        let lock: Redlock.Lock | null = null;
        try {
            lock = await this.redlock.lock(LOCK_KEY, LOCK_TTL_MS);
        } catch {
            this.logger.warn('Weekly-cycle tick skipped — another pod holds the lock.');
            return;
        }

        try {
            const result = await this.service.runAllWeeklyCutoffs(false);
            this.logger.log(`Weekly-cycle tick processed ${result.processed} equb(s).`);
        } catch (err) {
            this.logger.error(`Weekly-cycle tick failed: ${(err as Error).message}`);
        } finally {
            await lock.unlock().catch((e: Error) =>
                this.logger.warn('Failed to release weekly-cycle Redlock:', e),
            );
        }
    }
}
