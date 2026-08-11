import { Injectable } from '@nestjs/common';
import { AdminStatsRepository } from './admin-stats.repository';

@Injectable()
export class AdminStatsService {
    constructor(private readonly repo: AdminStatsRepository) {}

    async getDashboardStats(adminId: string, days: number = 30) {
        return this.repo.getDashboardStats(adminId, days);
    }
}
