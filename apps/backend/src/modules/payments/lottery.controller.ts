/**
 * lottery.controller.ts
 *
 * Lottery draw HTTP endpoints.
 *
 * Endpoints:
 *  GET  /api/v1/equbs/:id/draws         → 200 | 404      (any authenticated member)
 *  POST /api/v1/equbs/:id/draws         → 201 | 400 | 403 | 422 (admin/host only)
 */

import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { RlsContext } from '../../config/database.config';

@ApiTags('Lottery')
@Controller('api/v1/equbs')
export class LotteryController {
    constructor(private readonly paymentsService: PaymentsService) { }

    // ── GET /api/v1/equbs/:id/draws ──────────────────────────────────────────

    @Get(':id/draws')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List all lottery draws for an Equb' })
    @ApiResponse({ status: 200, description: 'Draw history returned.' })
    @ApiResponse({ status: 404, description: 'Equb not found.' })
    async listDraws(
        @CurrentUser() user: JwtPayload,
        @Param('id') equbId: string,
    ) {
        return this.paymentsService.listLotteryDraws(equbId);
    }

    // ── POST /api/v1/equbs/:id/draws ─────────────────────────────────────────

    @Post(':id/draws')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Run the lottery draw for the current round (host/admin only)',
    })
    @ApiResponse({ status: 201, description: 'Draw committed — winner selected.' })
    @ApiResponse({ status: 400, description: 'Equb inactive / already completed.' })
    @ApiResponse({ status: 403, description: 'Host or admin role required.' })
    @ApiResponse({ status: 422, description: 'No eligible members for this round.' })
    async runDraw(
        @CurrentUser() user: JwtPayload,
        @Param('id') equbId: string,
    ) {
        const ctx: RlsContext = { userId: user.sub, userRole: user.role };
        return this.paymentsService.runLotteryDraw(equbId, ctx);
    }
}