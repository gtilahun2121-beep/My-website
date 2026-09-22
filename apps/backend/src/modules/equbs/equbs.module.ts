import { Module } from '@nestjs/common';
import { EqubsController } from './equbs.controller';
import { EqubAdminController } from './equb-admin.controller';
import { MemberManagementController } from './controllers/member-management.controller';
import { EqubsService } from './equbs.service';
import { EqubsRepository } from './equbs.repository';
import { MemberManagementService } from './services/member-management.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [EqubsController, EqubAdminController, MemberManagementController],
    providers: [EqubsService, EqubsRepository, MemberManagementService],
    exports: [EqubsService, MemberManagementService],
})
export class EqubsModule {}
