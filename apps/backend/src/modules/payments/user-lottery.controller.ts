/**
 * user-lottery.controller.ts
 *
 * READ-ONLY, member-facing lottery endpoints. These power the "Lottery"
 * section of the authenticated user dashboard.
 *
 * Endpoints (all authenticated, never write):
 *  GET /api/v1/equbs/:id/lottery/current  → 200 | 404
 *  GET /api/v1/equbs/:id/lottery/history  → 200 | 404 (paginated)
 *
 * Authorization model:
 *  - These GET endpoints: any authenticated user (JwtAuthGuard).
 *  - The spin (POST /api/v1/equbs/:id/draws) lives in LotteryController and
 *    is gated to host/admin via RolesGuard, so a normal user calling it gets
 *    403.
 *
 * SECURITY: responses come from PaymentsService view models that expose only
 * the public display name. No phone/email/wallet/internal ids are returned.
 */

import {
    Controller,
    DefaultValuePipe,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('Lottery (User)')
@Controller('api/v1/equbs')
export class UserLotteryController {
    constructor(private readonly paymentsService: PaymentsService) { }

    // ── GET /api/v1/equbs/:id/lottery/current ────────────────────────────────

    @Get(':id/lottery/current')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            'Current lottery view for the authenticated member: active cycle, ' +
            'the user\'s backend-computed eligibility, and the latest public winner.',
    })
    @ApiResponse({ status: 200, description: 'Current lottery view returned.' })
    @ApiResponse({ status: 404, description: 'Equb not found.' })
    async current(
        @CurrentUser() user: JwtPayload,
        @Param('id') equbId: string,
    ) {
        return this.paymentsService.getLotteryCurrent(equbId, user.sub);
    }

    // ── GET /api/v1/equbs/:id/lottery/history ────────────────────────────────

    @Get(':id/lottery/history')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)', example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 10 })
    @ApiOperation({
        summary: 'Paginated public lottery history for an equb (display names only).',
    })
    @ApiResponse({ status: 200, description: 'Paginated history returned.' })
    @ApiResponse({ status: 404, description: 'Equb not found.' })
    async history(
        @Param('id') equbId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.paymentsService.getPublicLotteryHistory(equbId, page, limit);
    }
}
