import { Injectable } from '@nestjs/common';
import { AdminStatsRepository } from './admin-stats.repository';

@Injectable()
export class AdminStatsService {
    constructor(private readonly repo: AdminStatsRepository) {}

    async getDashboardStats(adminId: string) {
        return this.repo.getDashboardStats(adminId);
    }
}
