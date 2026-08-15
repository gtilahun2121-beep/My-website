import { Controller, Delete, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@qalnet/shared-types';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    async getNotifications(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.findByUserId(user.sub);
    }

    @Patch(':id/read')
    async markAsRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.notificationsService.markAsRead(id, user.sub);
    }

    /**
     * Permanently deletes a notification. Users delete after reading/doing;
     * admins delete after completing the pending task the notification flags.
     */
    @Delete(':id')
    async deleteNotification(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.notificationsService.delete(id, user.sub);
    }
}
