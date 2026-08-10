/**
 * equb-admin.controller.ts
 *
 * Admin-only Equb approval endpoints under /api/v1/admin.
 *
 * Security model:
 *  - Only admins can create Equbs directly (see EqubsController.createEqub).
 *  - Members submit equb creation requests and join requests; admins
 *    approve or reject them from here. Every route is gated by
 *    JwtAuthGuard + RolesGuard with @Roles('admin').
 */

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EqubsService } from './equbs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
export class EqubAdminController {
    constructor(private readonly equbsService: EqubsService) {}

    // ── Equb creation requests ────────────────────────────────────────────────

    @Get('equb-requests')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async listPendingRequests(@CurrentUser() user: JwtPayload) {
        return this.equbsService.listPendingRequests(user.sub);
    }

    @Post('equb-requests/:id/approve')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async approveRequest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.approveRequest(user.sub, id);
    }

    @Post('equb-requests/:id/reject')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async rejectRequest(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() body: { admin_notes?: string },
    ) {
        return this.equbsService.rejectRequest(user.sub, id, body?.admin_notes);
    }

    // ── Membership (join) requests ─────────────────────────────────────────────

    @Get('memberships/pending')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async listPendingMemberships(@CurrentUser() user: JwtPayload) {
        return this.equbsService.listPendingMemberships(user.sub);
    }

    @Post('memberships/:id/approve')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async approveMembership(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.approveMembership(user.sub, id);
    }

    @Post('memberships/:id/reject')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async rejectMembership(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.rejectMembership(user.sub, id);
    }
}
