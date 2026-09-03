import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * redis-cache.ts
 *
 * Thin, resilience-first cache around ioredis for serving hot read-heavy
 * aggregates (e.g. the admin dashboard KPIs).
 *
 * Design goals:
 *   - Never crash the process if Redis is unavailable or slow. Every method
 *     swallows errors and degrades to a cache miss so callers get fresh data
 *     from the database instead of an exception.
 *   - Lazy connection: nothing touches the network until the first command.
 *   - Values are JSON-serialised strings with an absolute TTL.
 *
 * Usage:
 *   const cached = await cache.get<AdminStats>('admin:stats:30d');
 *   if (cached) return cached;
 *   const stats = await computeExpensiveStats();
 *   await cache.set('admin:stats:30d', stats, 30);
 *   return stats;
 */
@Injectable()
export class RedisCache implements OnModuleDestroy {
    private readonly logger = new Logger(RedisCache.name);
    private readonly client: Redis | null;
    private readonly ttlSeconds: number;

    constructor(@Optional() ttlSeconds = 30) {
        this.ttlSeconds = ttlSeconds;

        const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
        const isTls = redisUrl.startsWith('rediss://');

        // Capture any lazyConnect ioredis constructor error. If ioredis itself
        // fails to build a client we keep a null client and the cache becomes
        // a no-op passthrough rather than crashing the request path.
        let client: Redis | null = null;
        try {
            client = new Redis(redisUrl, {
                enableReadyCheck: false,
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                connectTimeout: 2000,
                tls: isTls ? {} : undefined,
            });
        } catch {
            client = null;
        }
        this.client = client;

        if (this.client) {
            this.client.on('error', (err: Error) => {
                this.logger.warn(`[RedisCache] Connection error: ${err.message}`);
            });
        }
    }

    /**
     * Reads a JSON value from the cache. Returns `null` on cache miss or on
     * any Redis error — never throws.
     */
    async get<T>(key: string): Promise<T | null> {
        const client = this.client;
        if (!client) return null;
        try {
            const raw = await client.get(key);
            if (raw == null) return null;
            return JSON.parse(raw) as T;
        } catch (err) {
            this.logger.debug(`[RedisCache] get(${key}) failed: ${String(err)}`);
            return null;
        }
    }

    /**
     * Writes a JSON value with an absolute TTL. Swallows errors.
     * `ttlSeconds` overrides the default when provided.
     */
    async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
        const client = this.client;
        if (!client) return;
        try {
            const ttl = ttlSeconds ?? this.ttlSeconds;
            await client.set(key, JSON.stringify(value), 'EX', ttl);
        } catch (err) {
            this.logger.debug(`[RedisCache] set(${key}) failed: ${String(err)}`);
        }
    }

    /**
     * Invalidates a single key (e.g. after a write that changes aggregates).
     * Swallows errors.
     */
    async del(key: string): Promise<void> {
        const client = this.client;
        if (!client) return;
        try {
            await client.del(key);
        } catch (err) {
            this.logger.debug(`[RedisCache] del(${key}) failed: ${String(err)}`);
        }
    }

    /** Closes the Redis connection on app shutdown. */
    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            try {
                await this.client.quit();
            } catch {
                this.client.disconnect();
            }
        }
    }
}
