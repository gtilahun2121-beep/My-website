import { Module } from '@nestjs/common';
import { EqubsController } from './equbs.controller';
import { EqubAdminController } from './equb-admin.controller';
import { EqubsService } from './equbs.service';
import { EqubsRepository } from './equbs.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [EqubsController, EqubAdminController],
    providers: [EqubsService, EqubsRepository],
    exports: [EqubsService],
})
export class EqubsModule {}
