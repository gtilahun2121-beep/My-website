import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsRepository } from './admin-stats.repository';

@Module({
    controllers: [UsersController, AdminController],
    providers: [UsersService, UsersRepository, AdminStatsService, AdminStatsRepository],
    exports: [UsersService],
})
export class UsersModule {}
