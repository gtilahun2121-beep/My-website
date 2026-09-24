/**
 * Multi-Method Payment Service
 *
 * Orchestrates payments across multiple providers and methods.
 * Handles routing, verification, and reconciliation.
 *
 * Storage follows the canonical `payments` table shape used by the rest of the
 * platform (payment_status / transaction_reference / provider + additive
 * columns from migration 20260922_add_multi_method_payments.sql). Gateway
 * providers are resolved through PaymentProviderService so PAYMENT_MODE=sandbox
 * keeps development and CI hermetic.
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PaymentMethod,
  PaymentStatus,
  CreatePaymentDto,
  VerifyPaymentDto,
  PaymentInfoDto,
  PaymentVerificationResultDto,
  AvailablePaymentMethodsDto,
  PaymentMethodConfigDto,
} from '../dto/enhanced-payment.dto';
import { PaymentProvider, PaymentProviderName } from '../providers/payment-provider.interface';
import { PaymentProviderService } from '../providers/payment-provider.service';
import { WalletTransferProvider } from '../providers/wallet-transfer.provider';

const DB_STATUS_COMPLETED = ['paid', 'auto_debited'];

@Injectable()
export class MultiMethodPaymentService {
  private readonly logger = new Logger(MultiMethodPaymentService.name);
  private providers: Map<PaymentMethod, PaymentProvider> = new Map();

  constructor(
    private readonly dataSource: DataSource,
    private readonly providerService: PaymentProviderService,
  ) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // External gateways are resolved through the mode-aware provider service,
    // so sandbox mode returns a mock provider for every gateway.
    const gateway = (method: PaymentMethod): void => {
      this.providers.set(
        method,
        this.providerService.resolve(method as PaymentProviderName),
      );
    };

    gateway(PaymentMethod.CHAPA);
    gateway(PaymentMethod.TELEBIRR);
    gateway(PaymentMethod.DASHEN_BANK);
    this.providers.set(PaymentMethod.WALLET, new WalletTransferProvider(this.dataSource));

    this.logger.log(`Initialized ${this.providers.size} payment providers`);
  }

  /**
   * Get available payment methods
   */
  getAvailablePaymentMethods(): AvailablePaymentMethodsDto {
    const methods: PaymentMethodConfigDto[] = [
      {
        method: PaymentMethod.WALLET,
        name: 'QalNet Wallet',
        description: 'Transfer from your QalNet wallet balance',
        supported: true,
        minAmount: 10,
        maxAmount: 100000,
        processingTime: 'instant',
        fee: 0,
        icon: '💳',
        requirements: ['Active wallet'],
      },
      {
        method: PaymentMethod.CHAPA,
        name: 'Chapa',
        description: 'Pay with Chapa payment gateway',
        supported: true,
        minAmount: 50,
        maxAmount: 100000,
        processingTime: 'instant',
        fee: 1.5,
        icon: '🏦',
        requirements: ['Valid Chapa account'],
      },
      {
        method: PaymentMethod.TELEBIRR,
        name: 'Telebirr',
        description: 'Pay with Telebirr mobile money',
        supported: true,
        minAmount: 10,
        maxAmount: 50000,
        processingTime: 'instant',
        fee: 2.0,
        icon: '📱',
        requirements: ['Telebirr account', 'Phone number'],
      },
      {
        method: PaymentMethod.DASHEN_BANK,
        name: 'Dashen Bank',
        description: 'Direct bank transfer',
        supported: true,
        minAmount: 100,
        maxAmount: 500000,
        processingTime: '1-2 hours',
        fee: 0.5,
        icon: '🏧',
        requirements: ['Bank account', 'Account holder name'],
      },
      {
        method: PaymentMethod.MOBILE_MONEY,
        name: 'Mobile Money',
        description: 'Pay with mobile money provider',
        supported: false,
        minAmount: 10,
        maxAmount: 50000,
        processingTime: 'instant',
        fee: 1.0,
        icon: '📲',
        requirements: ['Mobile money account'],
      },
      {
        method: PaymentMethod.BANK_TRANSFER,
        name: 'Bank Transfer',
        description: 'Direct bank account transfer',
        supported: true,
        minAmount: 100,
        maxAmount: 500000,
        processingTime: '2-3 days',
        fee: 0,
        icon: '💰',
        requirements: ['Bank details'],
      },
    ];

    return {
      methods,
      defaultMethod: PaymentMethod.WALLET,
      userMethod: PaymentMethod.CHAPA,
    };
  }

  /**
   * Initiate payment with selected method
   */
  async initiatePayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<{
    paymentId: string;
    txRef: string;
    method: PaymentMethod;
    status: PaymentStatus;
    checkoutUrl?: string;
    providerReference?: string;
    externalUrl?: boolean;
  }> {
    this.logger.log(`Initiating ${dto.method} payment for user ${userId}, amount: ${dto.amount}`);

    // Validate payment method
    if (!this.providers.has(dto.method)) {
      throw new BadRequestException(`Payment method ${dto.method} not supported`);
    }

    // Validate amount against the method's configuration
    const methodConfig = this.getAvailablePaymentMethods().methods.find(
      (m) => m.method === dto.method,
    );
    if (!methodConfig?.supported) {
      throw new BadRequestException(`Payment method ${dto.method} is not currently available`);
    }
    if (dto.amount < methodConfig.minAmount || dto.amount > methodConfig.maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${methodConfig.minAmount} and ${methodConfig.maxAmount} ETB`,
      );
    }

    // Resolve the round number (payments.round_number is required)
    const roundNumber = await this.resolveRoundNumber(dto.equbId, dto.roundNumber);

    // The equb owner is the wallet-transfer recipient for wallet payments.
    let metadata: Record<string, unknown> = { ...dto.metadata };
    if (dto.method === PaymentMethod.WALLET) {
      const host = await this.dataSource.query(
        'SELECT host_id FROM equb_groups WHERE id = $1',
        [dto.equbId],
      );
      if (!host || host.length === 0) {
        throw new NotFoundException('Equb group not found');
      }
      metadata = {
        ...metadata,
        fromUserId: userId,
        toUserId: host[0].host_id,
      };
    }

    // Create payment record
    // Create payment record with database-generated ID
    const idResult = await this.dataSource.query(
      `SELECT gen_random_uuid() as id`,
    );
    const paymentId = idResult[0].id;
    const txRef = `QAL-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    await this.dataSource.query(
      `INSERT INTO payments
         (id, user_id, equb_id, round_number, amount, payment_status, transaction_reference, provider, payment_method)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)`,
      [paymentId, userId, dto.equbId, roundNumber, dto.amount, txRef, dto.method, dto.method],
    );

    // Get provider
    const provider = this.providers.get(dto.method)!;

    // Create checkout
    const checkout = await provider.createCheckout({
      amount: dto.amount,
      currency: 'ETB',
      txRef,
      callbackUrl: `${process.env.APP_URL ?? ''}/payments/callback/${paymentId}`,
      metadata: {
        userId,
        equbId: dto.equbId,
        roundNumber,
        ...metadata,
      },
    });

    // Update payment with provider reference
    if (checkout.providerReference) {
      await this.dataSource.query(
        `UPDATE payments SET provider_reference = $1 WHERE id = $2`,
        [checkout.providerReference, paymentId],
      );
    }

    return {
      paymentId,
      txRef,
      method: dto.method,
      status: PaymentStatus.PENDING,
      checkoutUrl: checkout.checkoutUrl || undefined,
      providerReference: checkout.providerReference,
      externalUrl: !!checkout.checkoutUrl,
    };
  }

  /**
   * Verify and complete payment
   */
  async verifyPayment(
    userId: string,
    dto: VerifyPaymentDto,
  ): Promise<PaymentVerificationResultDto> {
    try {
      this.logger.log(`Verifying payment: ${dto.txRef}`);

      // Get payment record
      const payment = await this.dataSource.query(
        `SELECT * FROM payments WHERE transaction_reference = $1 AND user_id = $2`,
        [dto.txRef, userId],
      );

      if (!payment || payment.length === 0) {
        throw new NotFoundException('Payment not found');
      }

      const paymentRecord = payment[0];
      const method = paymentRecord.payment_method || paymentRecord.provider;
      const provider = this.providers.get(method);

      if (!provider) {
        throw new BadRequestException('Unknown payment method');
      }

      // Verify with provider
      const verification = await provider.verifyTransaction({
        txRef: dto.txRef,
        expectedAmount: dto.expectedAmount ?? parseFloat(paymentRecord.amount),
        providerReference: dto.providerReference || paymentRecord.provider_reference,
      });

      const dbStatus = verification.status === 'success' ? 'paid' : 'failed';

      await this.dataSource.query(
        `UPDATE payments
         SET payment_status = $1,
             provider_reference = $2,
             failure_reason = $3,
             paid_at = CASE WHEN $5 = 'paid' THEN NOW() ELSE paid_at END,
             completed_at = CASE WHEN $5 = 'paid' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [
          dbStatus,
          verification.providerReference ?? paymentRecord.provider_reference,
          verification.failureReason ?? null,
          paymentRecord.id,
          dbStatus,
        ],
      );

      return {
        success: verification.verified,
        status: this.toApiStatus(dbStatus),
        paymentId: paymentRecord.id,
        amount: verification.amount || parseFloat(paymentRecord.amount),
        txRef: dto.txRef,
        failureReason: verification.failureReason,
        message: verification.verified
          ? 'Payment verified successfully'
          : 'Payment verification failed',
      };
    } catch (error) {
      this.logger.error('Payment verification error:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        amount: 0,
        txRef: dto.txRef,
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        message: 'Payment verification failed',
      };
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    payments: PaymentInfoDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;

    const payments = await this.dataSource.query(
      `SELECT * FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset],
    );

    const total = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM payments WHERE user_id = $1`,
      [userId],
    );

    return {
      payments: payments.map((p: any) => this.mapPaymentToDto(p)),
      total: parseInt(total[0].count, 10),
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * Handle webhook from payment provider
   */
  async handleProviderWebhook(
    method: string,
    rawBody: Buffer,
    signature: string,
    payload: any,
  ): Promise<void> {
    try {
      this.logger.log(`Handling webhook from ${method}`);

      const provider = this.providers.get(method as PaymentMethod);
      if (!provider) {
        throw new BadRequestException(`Unknown payment method: ${method}`);
      }

      // Verify signature
      const isValid = await provider.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

      // Process webhook payload
      const txRef = payload.tx_ref || payload.reference;
      if (!txRef) {
        this.logger.warn('Webhook missing transaction reference');
        return;
      }

      // Update payment status
      const verification = await provider.verifyTransaction({
        txRef,
        expectedAmount: payload.amount,
        providerReference: payload.provider_reference,
      });

      const newStatus = verification.status === 'success' ? 'paid' : 'failed';

      await this.dataSource.query(
        `UPDATE payments
         SET payment_status = $1,
             provider_reference = $2,
             failure_reason = $3,
             paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
             updated_at = NOW()
         WHERE transaction_reference = $4`,
        [
          newStatus,
          verification.providerReference ?? null,
          verification.failureReason ?? null,
          txRef,
        ],
      );

      this.logger.log(`Payment ${txRef} updated to ${newStatus}`);
    } catch (error) {
      this.logger.error('Webhook processing error:', error);
      // Continue - webhook should not fail the request
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(userId: string, paymentId: string): Promise<PaymentInfoDto> {
    const payment = await this.dataSource.query(
      `SELECT * FROM payments WHERE id = $1 AND user_id = $2`,
      [paymentId, userId],
    );

    if (!payment || payment.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapPaymentToDto(payment[0]);
  }

  private async resolveRoundNumber(equbId: string, roundNumber?: number): Promise<number> {
    if (roundNumber !== undefined && Number.isInteger(roundNumber) && roundNumber > 0) {
      return roundNumber;
    }

    const rows = await this.dataSource.query(
      'SELECT current_round FROM equb_groups WHERE id = $1',
      [equbId],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Equb group not found');
    }

    const current = parseInt(rows[0].current_round, 10);
    if (current < 1) {
      throw new BadRequestException(
        "This Equb has not started any rounds yet — pass a valid round_number.",
      );
    }
    return current;
  }

  private mapPaymentToDto(payment: any): PaymentInfoDto {
    return {
      id: payment.id,
      userId: payment.user_id,
      equbId: payment.equb_id,
      amount: parseFloat(payment.amount),
      method: (payment.payment_method || payment.provider) as PaymentMethod,
      status: this.toApiStatus(payment.payment_status),
      txRef: payment.transaction_reference,
      providerReference: payment.provider_reference,
      failureReason: payment.failure_reason,
      createdAt: new Date(payment.created_at),
      completedAt: payment.completed_at
        ? new Date(payment.completed_at)
        : payment.paid_at
          ? new Date(payment.paid_at)
          : undefined,
      metadata: payment.tx_metadata,
    };
  }

  private toApiStatus(dbStatus: string): PaymentStatus {
    if (DB_STATUS_COMPLETED.includes(dbStatus)) return PaymentStatus.COMPLETED;
    if (dbStatus === 'processing') return PaymentStatus.PROCESSING;
    if (dbStatus === 'cancelled') return PaymentStatus.CANCELLED;
    if (dbStatus === 'refunded') return PaymentStatus.REFUNDED;
    if (dbStatus === 'failed') return PaymentStatus.FAILED;
    return PaymentStatus.PENDING;
  }
}