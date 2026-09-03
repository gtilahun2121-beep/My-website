import { Injectable } from '@nestjs/common';
import { AdminStatsRepository } from './admin-stats.repository';
import { RedisCache } from '../../common/cache/redis-cache';

/**
 * admin-stats.service.ts
 *
 * Orchestrates the admin dashboard aggregates with a short-TTL Redis cache.
 *
 * Performance rationale:
 *   - The KPI block is range-independent and expensive (full-table scans over
 *     users/payments/payouts/wallets). Caching it for a short TTL (default
 *     30s) means dashboard reloads and range toggles serve it from Redis and
 *     skip the heavy aggregation.
 *   - The window block (trend / recent transactions / top equbs) depends on
 *     the requested range, so it is cached under a key that includes the
 *     resolved window.
 *   - Redis is best-effort: if it is unavailable every access degrades to a
 *     cache miss and queries the database directly.
 */
@Injectable()
export class AdminStatsService {
    constructor(
        private readonly repo: AdminStatsRepository,
        private readonly cache: RedisCache,
    ) {}

    async getDashboardStats(
        adminId: string,
        window: { days?: number; start?: string; end?: string } = {},
    ) {
        const kpisKey = `admin:stats:kpis`;
        const windowDataKey = `admin:stats:window:${this.windowKey(window)}`;

        // 1. Range-independent KPIs (heavy) — cached 30s.
        let kpis = await this.cache.get<Record<string, unknown>>(kpisKey);
        if (!kpis) {
            kpis = await this.repo.getKpis(adminId);
            await this.cache.set(kpisKey, kpis, 30);
        }

        // 2. Window-specific aggregates (trend / recent / top) — cached 30s.
        let windowData = await this.cache.get<{
            trend: unknown[];
            recent_transactions: unknown[];
            top_equbs: unknown[];
        }>(windowDataKey);
        if (!windowData) {
            windowData = await this.repo.getWindowStats(adminId, window);
            await this.cache.set(windowDataKey, windowData, 30);
        }

        return {
            kpis,
            ...windowData,
        };
    }

    /** Builds a stable string key from the resolved window parameters. */
    private windowKey(window: { days?: number; start?: string; end?: string }): string {
        return `${window.days ?? ''}:${window.start ?? ''}:${window.end ?? ''}`;
    }
}
