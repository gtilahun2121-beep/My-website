/**
 * auction.controller.ts
 *
 * Bidding auction HTTP endpoints.
 *
 * Endpoints:
 *  GET  /api/v1/equbs/:id/bids?round=N          → 200 | 404 (any authenticated member)
 *  POST /api/v1/equbs/:id/auction/resolve       → 201 | 400 | 403 | 422 (host/admin only)
 */

import {
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

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { RlsContext } from '../../config/database.config';

@ApiTags('Auction')
@Controller('api/v1/equbs')
export class AuctionController {
    constructor(private readonly paymentsService: PaymentsService) {}

    // ── GET /api/v1/equbs/:id/bids?round=N ─────────────────────────────────

    @Get(':id/bids')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List all bids for a round (auction leaderboard)' })
    @ApiResponse({ status: 200, description: 'Bids returned.' })
    @ApiResponse({ status: 404, description: 'Equb not found.' })
    async listBids(
        @CurrentUser() _user: JwtPayload,
        @Param('id') equbId: string,
        @Query('round') round: string,
    ) {
        return this.paymentsService.listRoundBids(equbId, parseInt(round, 10));
    }

    // ── POST /api/v1/equbs/:id/auction/resolve ─────────────────────────────

    @Post(':id/auction/resolve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Resolve the current round auction — highest bidder wins (host/admin only)',
    })
    @ApiResponse({ status: 201, description: 'Auction resolved — winner selected.' })
    @ApiResponse({ status: 400, description: 'Equb inactive / already completed.' })
    @ApiResponse({ status: 403, description: 'Host or admin role required.' })
    @ApiResponse({ status: 422, description: 'No bids for this round.' })
    async resolveAuction(
        @CurrentUser() user: JwtPayload,
        @Param('id') equbId: string,
    ) {
        const ctx: RlsContext = { userId: user.sub, userRole: user.role };
        return this.paymentsService.resolveRoundAuction(equbId, ctx);
    }
}