/**
 * payments.controller.ts
 *
 * Handles all payment HTTP endpoints under /api/v1/payments.
 *
 * Endpoints (from spec §2.1):
 *  GET  /api/v1/payments/pending      → 200 | 401
 *  POST /api/v1/payments/checkout     → 200 | 400 | 422
 *  POST /api/v1/payments/webhook      → 200 | 401 | 409
 *  POST /api/v1/equbs/:id/bid         → 201 | 400 | 403
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
    Req,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { PaymentsService } from './payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { WebhookDto } from './dto/webhook.dto';
import { BidDto } from './dto/bid.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('Payments')
@Controller('api/v1')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    // ── GET /api/v1/payments/pending ─────────────────────────────────────────

    @Get('payments/pending')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get outstanding payment objects for the active round' })
    @ApiResponse({ status: 200, description: 'Pending payments returned.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getPending(
        @CurrentUser() user: JwtPayload,
        @Query('equb_id') equbId: string,
        @Query('round') round: string,
    ) {
        return this.paymentsService.getPendingPayments(equbId, parseInt(round, 10));
    }

    // ── POST /api/v1/payments/checkout ───────────────────────────────────────

    @Post('payments/checkout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Initiate wallet deduction or external payment checkout' })
    @ApiResponse({ status: 200, description: 'Checkout initiated.' })
    @ApiResponse({ status: 400, description: 'Validation or business logic error.' })
    @ApiResponse({ status: 422, description: 'Unprocessable — e.g. already paid.' })
    async checkout(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: CheckoutDto,
    ) {
        return this.paymentsService.checkout(dto, {
            userId: user.sub,
            userRole: user.role,
        });
    }

    // ── POST /api/v1/payments/webhook ────────────────────────────────────────

    @Post('payments/webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Ingest secure payment callbacks from Chapa or Telebirr',
        description:
            'This endpoint is called by payment processors. ' +
            'HMAC signature is validated before any processing.',
    })
    @ApiResponse({ status: 200, description: 'Webhook received.' })
    @ApiResponse({ status: 401, description: 'Invalid HMAC signature.' })
    @ApiResponse({ status: 409, description: 'Duplicate event.' })
    async webhook(
        @Req() req: Request,
        @Body(new ValidationPipe({ whitelist: true }))
        dto: WebhookDto,
    ) {
        // Raw body is needed for HMAC verification
        // Requires express raw body middleware (set in main.ts for this route)
        const rawBody = (req as any).rawBody as Buffer ?? Buffer.from(JSON.stringify(dto));
        const sig = (req.headers['x-chapa-signature'] ??
            req.headers['x-telebirr-signature'] ??
            '') as string;

        return this.paymentsService.handleWebhook(dto, rawBody, sig);
    }

    // ── POST /api/v1/equbs/:id/bid ───────────────────────────────────────────

    @Post('equbs/:id/bid')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('participant', 'host')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Submit a discount bid (B_r) to win early payout in the current round',
    })
    @ApiResponse({ status: 201, description: 'Bid recorded.' })
    @ApiResponse({ status: 400, description: 'Invalid bid.' })
    @ApiResponse({ status: 403, description: 'Forbidden — admins cannot bid.' })
    async submitBid(
        @CurrentUser() user: JwtPayload,
        @Param('id') equbId: string,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: BidDto,
    ) {
        // Override equb_id from URL param (more RESTful)
        dto.equb_id = equbId;

        return this.paymentsService.submitBid(dto, {
            userId: user.sub,
            userRole: user.role,
        });
    }
}
