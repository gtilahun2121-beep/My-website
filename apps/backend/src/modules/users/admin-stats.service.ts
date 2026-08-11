import { Injectable } from '@nestjs/common';
import { AdminStatsRepository } from './admin-stats.repository';

@Injectable()
export class AdminStatsService {
    constructor(private readonly repo: AdminStatsRepository) {}

    async getDashboardStats(
        adminId: string,
        window: { days?: number; start?: string; end?: string } = {},
    ) {
        return this.repo.getDashboardStats(adminId, window);
    }
}
