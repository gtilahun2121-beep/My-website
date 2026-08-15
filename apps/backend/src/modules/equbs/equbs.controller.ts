import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EqubsService } from './equbs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@Controller('api/v1/equbs')
@UseGuards(JwtAuthGuard)
export class EqubsController {
    constructor(private readonly equbsService: EqubsService) {}

    @Get()
    async listEqubs(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.equbsService.findAll(parseInt(limit ?? '', 10), parseInt(offset ?? '', 10));
    }

    @Get('mine')
    async getMyEqubs(
        @CurrentUser() user: JwtPayload,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.equbsService.findMine(user.sub, parseInt(limit ?? '', 10), parseInt(offset ?? '', 10));
    }

    @Get('requests/mine')
    async getMyRequests(@CurrentUser() user: JwtPayload) {
        return this.equbsService.getMyRequests(user.sub);
    }

    @Get(':id')
    async getEqub(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.findById(id, user.sub);
    }

    /**
     * Direct Equb creation is ADMIN-ONLY.
     * Regular members must POST /api/v1/equbs/requests and wait for
     * admin approval — enforced here at the role level (defense in depth).
     */
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async createEqub(@CurrentUser() user: JwtPayload, @Body() dto: any) {
        const equb = this.equbsService.validateCreatePayload(dto);
        return this.equbsService.create(user.sub, equb);
    }

    /**
     * A member asks the admin to create an Equb they want.
     * The admin reviews and approves/rejects it via the admin API.
     */
    @Post('requests')
    async requestEqub(@CurrentUser() user: JwtPayload, @Body() dto: any) {
        return this.equbsService.requestCreate(user.sub, dto);
    }

    @Post(':id/join')
    async joinEqub(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.join(id, user.sub, user.role);
    }

    /**
     * Starts the first round of an 'open' Equb (status → 'active',
     * current_round → 1). Host/admin only — enforced by RolesGuard.
     */
    @Post(':id/activate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    async activateEqub(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.activate(id, user.sub, user.role);
    }
}
