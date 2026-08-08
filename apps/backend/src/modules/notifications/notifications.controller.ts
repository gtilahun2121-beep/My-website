import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserProfile } from '@qalnet/shared-types';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    async getNotifications(@CurrentUser() user: UserProfile) {
        return this.notificationsService.findByUserId(user.id);
    }

    @Patch(':id/read')
    async markAsRead(@CurrentUser() user: UserProfile, @Param('id') id: string) {
        return this.notificationsService.markAsRead(id, user.id);
    }
}
