/**
 * admin.controller.ts
 *
 * Admin-only endpoints under /api/v1/admin.
 * Every route requires a valid JWT whose `role` claim is `admin`.
 */

import { Controller, Get, Query, Body, Post, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminFinanceService } from './admin-finance.service';
import { ResetPinDto } from './dto/reset-pin.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
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
        private readonly adminFinanceService: AdminFinanceService,
    ) {}

    @Get('stats')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Dashboard aggregates — KPIs, activity trend (7d/30d/90d or custom start/end dates), recent transactions, top equbs' })
    @ApiResponse({ status: 200, description: 'Dashboard statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    async getDashboardStats(
        @CurrentUser() user: JwtPayload,
        @Query('range') range?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        const isoDate = /^\d{4}-\d{2}-\d{2}$/;
        const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '30d' ? 30 : undefined;
        return this.adminStatsService.getDashboardStats(user.sub, {
            days,
            start: start && isoDate.test(start) ? start : undefined,
            end: end && isoDate.test(end) ? end : undefined,
        });
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

    @Patch('users/:id/role')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Grant or revoke a user role — promote a member to website admin or demote them' })
    @ApiResponse({ status: 200, description: 'Role updated.' })
    @ApiResponse({ status: 400, description: 'Cannot change your own role.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async updateUserRole(
        @CurrentUser() user: JwtPayload,
        @Param('id') userId: string,
        @Body() dto: UpdateRoleDto,
    ) {
        return this.usersService.setUserRole(user.sub, userId, dto.role);
    }

    @Get('finance/overview')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Finance KPIs — wallet balance, transaction volume, fees, payout and withdrawal aggregates' })
    @ApiResponse({ status: 200, description: 'Finance overview aggregates.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    async getFinanceOverview(@CurrentUser() user: JwtPayload) {
        return this.adminFinanceService.getFinanceOverview(user.sub);
    }

    @Get('finance/transactions')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List payments (paged, searchable, filterable by status and date range)' })
    @ApiResponse({ status: 200, description: 'Paged payment list.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    async listFinanceTransactions(
        @CurrentUser() user: JwtPayload,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        const isoDate = /^\d{4}-\d{2}-\d{2}$/;
        const validStatus = ['pending', 'paid', 'auto_debited', 'failed'].includes(status ?? '');
        return this.adminFinanceService.listTransactions({
            adminId: user.sub,
            page: Math.max(1, parseInt(page ?? '1', 10) || 1),
            limit: Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
            status: validStatus ? status : undefined,
            search,
            start: start && isoDate.test(start) ? start : undefined,
            end: end && isoDate.test(end) ? end : undefined,
        });
    }

    @Get('finance/payouts')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List rotation payouts (paged, filterable by status)' })
    @ApiResponse({ status: 200, description: 'Paged payout list.' })
    @ApiResponse({ status: 403, description: 'Forbidden — requires role admin.' })
    async listFinancePayouts(
        @CurrentUser() user: JwtPayload,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
    ) {
        const validStatus = ['pending', 'approved', 'batched', 'completed', 'failed'].includes(status ?? '');
        return this.adminFinanceService.listPayouts({
            adminId: user.sub,
            page: Math.max(1, parseInt(page ?? '1', 10) || 1),
            limit: Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
            status: validStatus ? status : undefined,
        });
    }
}
