/**
 * Multi-Method Payment Controller
 *
 * Handles enhanced payment endpoints with multi-provider support
 * Endpoints for payment initiation, verification, history, and webhooks
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { MultiMethodPaymentService } from './services/multi-method-payment.service';
import {
  CreatePaymentDto,
  VerifyPaymentDto,
} from './dto/enhanced-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('Payments - Multi-Method')
@Controller('api/v1/payments')
export class MultiMethodPaymentController {
  constructor(private readonly multiMethodPaymentService: MultiMethodPaymentService) {}

  // ── GET /api/v1/payments/methods ─────────────────────────────────────────

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available payment methods',
    description:
      'Returns list of supported payment methods with configuration and requirements',
  })
  @ApiResponse({ status: 200, description: 'Available payment methods returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getAvailablePaymentMethods() {
    return this.multiMethodPaymentService.getAvailablePaymentMethods();
  }

  // ── POST /api/v1/payments/initiate ───────────────────────────────────────

  @Post('initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('participant', 'host', 'admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate a payment with selected method',
    description: 'Create a new payment and get checkout URL or provider reference',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initiated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment method or amount.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  async initiatePayment(
    @CurrentUser() user: JwtPayload,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreatePaymentDto,
  ) {
    return this.multiMethodPaymentService.initiatePayment(user.sub, dto);
  }

  // ── POST /api/v1/payments/verify ─────────────────────────────────────────

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a payment',
    description: 'Verify payment status with provider and update local records',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid verification parameters.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found.',
  })
  async verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: VerifyPaymentDto,
  ) {
    return this.multiMethodPaymentService.verifyPayment(user.sub, dto);
  }

  // ── GET /api/v1/payments/history ─────────────────────────────────────────

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Retrieve paginated payment history for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history returned.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  async getPaymentHistory(
    @CurrentUser() user: JwtPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.multiMethodPaymentService.getPaymentHistory(
      user.sub,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  // ── GET /api/v1/payments/:paymentId ──────────────────────────────────────

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get payment details',
    description: 'Retrieve detailed information for a specific payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details returned.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found.',
  })
  async getPaymentDetails(
    @CurrentUser() user: JwtPayload,
    @Param('paymentId') paymentId: string,
  ) {
    return this.multiMethodPaymentService.getPaymentDetails(user.sub, paymentId);
  }

  // ── POST /api/v1/payments/webhook/chapa ──────────────────────────────────

  @Post('webhook/chapa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chapa payment webhook',
    description: 'Webhook endpoint for Chapa payment callbacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid signature.',
  })
  async handleChapaWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    const rawBody = (req as any).rawBody as Buffer ?? Buffer.from(JSON.stringify(payload));
    const signature = (req.headers['x-chapa-signature'] ?? '') as string;

    await this.multiMethodPaymentService.handleProviderWebhook(
      'chapa',
      rawBody,
      signature,
      payload,
    );

    return { status: 'ok' };
  }

  // ── POST /api/v1/payments/webhook/telebirr ───────────────────────────────

  @Post('webhook/telebirr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Telebirr payment webhook',
    description: 'Webhook endpoint for Telebirr payment callbacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid signature.',
  })
  async handleTelebirrWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    const rawBody = (req as any).rawBody as Buffer ?? Buffer.from(JSON.stringify(payload));
    const signature = (req.headers['x-telebirr-signature'] ?? '') as string;

    await this.multiMethodPaymentService.handleProviderWebhook(
      'telebirr',
      rawBody,
      signature,
      payload,
    );

    return { status: 'ok' };
  }

  // ── POST /api/v1/payments/webhook/dashen ─────────────────────────────────

  @Post('webhook/dashen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dashen Bank payment webhook',
    description: 'Webhook endpoint for Dashen Bank payment callbacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid signature.',
  })
  async handleDashenWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    const rawBody = (req as any).rawBody as Buffer ?? Buffer.from(JSON.stringify(payload));
    const signature = (req.headers['x-dashen-signature'] ?? '') as string;

    await this.multiMethodPaymentService.handleProviderWebhook(
      'dashen_bank',
      rawBody,
      signature,
      payload,
    );

    return { status: 'ok' };
  }

  // ── POST /api/v1/payments/webhook/wallet ─────────────────────────────────

  @Post('webhook/wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Wallet transfer webhook',
    description: 'Webhook endpoint for internal wallet transfer callbacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed.',
  })
  async handleWalletWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    const rawBody = (req as any).rawBody as Buffer ?? Buffer.from(JSON.stringify(payload));

    await this.multiMethodPaymentService.handleProviderWebhook(
      'wallet',
      rawBody,
      '',
      payload,
    );

    return { status: 'ok' };
  }
}
