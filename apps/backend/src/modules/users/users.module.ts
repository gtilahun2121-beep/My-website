import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsRepository } from './admin-stats.repository';
import { AdminFinanceService } from './admin-finance.service';
import { AdminFinanceRepository } from './admin-finance.repository';
import { AdminOperationsService } from './admin-operations.service';
import { AdminOperationsRepository } from './admin-operations.repository';
import { RedisCache } from '../../common/cache/redis-cache';

@Module({
    controllers: [UsersController, AdminController],
    providers: [
        UsersService,
        UsersRepository,
        AdminStatsService,
        AdminStatsRepository,
        AdminFinanceService,
        AdminFinanceRepository,
        AdminOperationsService,
        AdminOperationsRepository,
        RedisCache,
    ],
    exports: [UsersService],
})
export class UsersModule {}
