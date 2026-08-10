import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
    controllers: [UsersController, AdminController],
    providers: [UsersService, UsersRepository],
    exports: [UsersService],
})
export class UsersModule {}
