import { Injectable } from '@nestjs/common';
import {
    AdminOperationsRepository,
    AdminOpsListOptions,
} from './admin-operations.repository';

@Injectable()
export class AdminOperationsService {
    constructor(private readonly repo: AdminOperationsRepository) {}

    listWallets(opts: AdminOpsListOptions) {
        return this.repo.listWallets(opts);
    }

    listEqubs(opts: AdminOpsListOptions) {
        return this.repo.listEqubs(opts);
    }

    listSystemLogs(opts: AdminOpsListOptions) {
        return this.repo.listSystemLogs(opts);
    }
}