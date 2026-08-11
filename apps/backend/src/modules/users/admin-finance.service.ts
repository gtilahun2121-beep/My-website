import { Injectable } from '@nestjs/common';
import { AdminFinanceRepository, ListFinanceOptions } from './admin-finance.repository';

@Injectable()
export class AdminFinanceService {
    constructor(private readonly repo: AdminFinanceRepository) {}

    async getFinanceOverview(adminId: string) {
        return this.repo.getFinanceOverview(adminId);
    }

    async listTransactions(opts: ListFinanceOptions) {
        return this.repo.listTransactions(opts);
    }

    async listPayouts(opts: ListFinanceOptions) {
        return this.repo.listPayouts(opts);
    }
}
