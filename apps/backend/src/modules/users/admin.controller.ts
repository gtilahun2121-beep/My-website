/**
 * admin.controller.ts
 *
 * Admin-only endpoints under /api/v1/admin.
 * Every route requires a valid JWT whose `role` claim is `admin`.
 */

import { Controller, Get, Query, Body, Post, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { AdminStatsService } from './admin-stats.service';
import { ResetPinDto } from './dto/reset-pin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('Admin')
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
    constructor(
        private readonly usersService: UsersService,
        private readonly adminStatsService: AdminStatsService,
    ) {}

    @Get('stats')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Dashboard aggregates — KPIs, 30-day trend, recent transactions, top equbs' })
    @ApiResponse({ status: 200, description: 'Dashboard statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    async getDashboardStats(@CurrentUser() user: JwtPayload) {
        return this.adminStatsService.getDashboardStats(user.sub);
    }

    @Get('users')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List registered customers (paged, searchable, filterable)' })
    @ApiResponse({ status: 200, description: 'Paged customer list + summary KPIs.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    async listUsers(
        @CurrentUser() user: JwtPayload,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('role') role?: string,
        @Query('status') status?: string,
    ) {
        const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

        return this.usersService.listCustomers({
            adminId: user.sub,
            page: parsedPage,
            limit: parsedLimit,
            search,
            role,
            status: status === 'active' || status === 'inactive' ? status : undefined,
        });
    }

    @Post('users/:id/reset-pin')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Reset a user PIN and clear any login lockout' })
    @ApiResponse({ status: 200, description: 'PIN reset and account unlocked.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async resetUserPin(
        @CurrentUser() user: JwtPayload,
        @Param('id') userId: string,
        @Body() dto: ResetPinDto,
    ) {
        return this.usersService.resetUserPin(user.sub, userId, dto.new_pin);
    }
}
