/**
 * payouts.controller.ts
 *
 * Disbursement HTTP endpoints (Tier 3).
 *
 * Endpoints:
 *  GET  /api/v1/payouts?equb_id=…        → 200 | 401 (authenticated member)
 *  POST /api/v1/payouts/process           → 201 | 403 (host/admin — batch)
 *  POST /api/v1/payouts/:id/queue         → 201 | 403 (host/admin)
 *  POST /api/v1/payouts/:id/retry         → 201 | 403 (host/admin)
 *  POST /api/v1/payouts/:id/review        → 201 | 403 (host/admin)
 */

import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { RlsContext } from '../../config/database.config';

class ReviewPayoutDto {
    @IsString()
    @IsNotEmpty()
    reason: string;
}

@ApiTags('Payouts')
@Controller('api/v1/payouts')
export class PayoutsController {
    constructor(private readonly payoutsService: PayoutsService) { }

    private ctx(user: JwtPayload): RlsContext {
        return { userId: user.sub, userRole: user.role };
    }

    // ── GET /api/v1/payouts ─────────────────────────────────────────────────

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List payouts (optionally filtered by equb)' })
    @ApiResponse({ status: 200, description: 'Payouts returned.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async list(
        @CurrentUser() _user: JwtPayload,
        @Query('equb_id') equbId?: string,
    ) {
        return this.payoutsService.listPayouts(equbId);
    }

    // ── POST /api/v1/payouts/process ────────────────────────────────────────

    @Post('process')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Process all ready payouts as a batch (host/admin only)',
    })
    @ApiResponse({ status: 201, description: 'Payout batch processed.' })
    @ApiResponse({ status: 403, description: 'Host or admin role required.' })
    async process(
        @CurrentUser() user: JwtPayload,
    ) {
        return this.payoutsService.processPendingPayouts(this.ctx(user));
    }

    // ── POST /api/v1/payouts/:id/queue ──────────────────────────────────────

    @Post(':id/queue')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Queue a pending payout for disbursement' })
    @ApiResponse({ status: 201, description: 'Payout queued.' })
    @ApiResponse({ status: 403, description: 'Host or admin role required.' })
    async queue(
        @CurrentUser() user: JwtPayload,
        @Param('id') payoutId: string,
    ) {
        return this.payoutsService.queuePayout(payoutId, this.ctx(user));
    }

    // ── POST /api/v1/payouts/:id/retry ──────────────────────────────────────

    @Post(':id/retry')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Retry a failed payout' })
    @ApiResponse({ status: 201, description: 'Payout queued for retry.' })
    @ApiResponse({ status: 403, description: 'Host or admin role required.' })
    async retry(
        @CurrentUser() user: JwtPayload,
        @Param('id') payoutId: string,
    ) {
        return this.payoutsService.retryPayout(payoutId, this.ctx(user));
    }

    // ── POST /api/v1/payouts/:id/review ─────────────────────────────────────

    @Post(':id/review')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Hold a payout for manual review' })
    @ApiResponse({ status: 201, description: 'Payout held for review.' })
    @ApiResponse({ status: 403, description: 'Host or admin role required.' })
    async review(
        @CurrentUser() user: JwtPayload,
        @Param('id') payoutId: string,
        @Body() dto: ReviewPayoutDto,
    ) {
        return this.payoutsService.holdForManualReview(
            payoutId,
            dto.reason,
            this.ctx(user),
        );
    }
}