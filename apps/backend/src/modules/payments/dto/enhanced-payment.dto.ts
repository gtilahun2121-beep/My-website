/**
 * Enhanced Payment DTOs
 *
 * Data transfer objects for multi-method payment processing
 */

import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Supported payment methods
 */
export enum PaymentMethod {
  CHAPA = 'chapa',
  TELEBIRR = 'telebirr',
  DASHEN_BANK = 'dashen_bank',
  WALLET = 'wallet',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Create payment request DTO
 */
export class CreatePaymentDto {
  /**
   * Payment amount in ETB
   */
  @ApiProperty({ description: 'Payment amount in ETB', example: 500 })
  @IsNumber()
  @IsPositive()
  amount: number;

  /**
   * Selected payment method
   */
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.WALLET })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  /**
   * Equb ID for contribution
   */
  @ApiProperty({ description: 'Equb group ID the payment is for' })
  @IsUUID()
  equbId: string;

  /**
   * Round number for the payment
   */
  @ApiPropertyOptional({ description: 'Round number (falls back to the equb current round)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  roundNumber?: number;

  /**
   * Optional metadata (bank account, phone number, etc.)
   */
  @ApiPropertyOptional({
    description: 'Method-specific metadata (e.g. toUserId for wallet transfers)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    bankCode?: string;
    accountNumber?: string;
    accountHolderName?: string;
    phoneNumber?: string;
    mobileMoneyProvider?: string;
  };

  /**
   * Optional description
   */
  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;
}

/**
 * Payment verification request DTO
 */
export class VerifyPaymentDto {
  /**
   * Transaction reference
   */
  @ApiProperty({ description: 'Transaction reference returned at initiation' })
  @IsString()
  @MinLength(3)
  txRef: string;

  /**
   * Gateway-specific reference (if available)
   */
  @ApiPropertyOptional({ description: 'Gateway-specific reference (if available)' })
  @IsOptional()
  @IsString()
  providerReference?: string;

  /**
   * Optional expected amount for validation
   */
  @ApiPropertyOptional({ description: 'Optional expected amount for validation' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  expectedAmount?: number;
}

/**
 * Payment information DTO
 */
export class PaymentInfoDto {
  id: string;
  userId: string;
  equbId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  txRef: string;
  providerReference?: string;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: any;
}

/**
 * Payment verification result DTO
 */
export class PaymentVerificationResultDto {
  success: boolean;
  status: PaymentStatus;
  paymentId?: string;
  amount: number;
  txRef: string;
  failureReason?: string;
  message: string;
}

/**
 * Payment method configuration DTO
 */
export class PaymentMethodConfigDto {
  method: PaymentMethod;
  name: string;
  description: string;
  supported: boolean;
  minAmount: number;
  maxAmount: number;
  processingTime: string; // e.g., "instant", "1-2 hours", "1-2 days"
  fee: number; // percentage
  icon?: string;
  requirements?: string[];
}

/**
 * Available payment methods response
 */
export class AvailablePaymentMethodsDto {
  methods: PaymentMethodConfigDto[];
  defaultMethod: PaymentMethod;
  userMethod?: PaymentMethod; // User's preferred method
}

/**
 * Payment history filter DTO
 */
export class PaymentHistoryFilterDto {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  method?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  equbId?: string;
}

/**
 * Payment history response DTO
 */
export class PaymentHistoryResponseDto {
  payments: PaymentInfoDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Refund request DTO
 */
export class RefundPaymentDto {
  paymentId: string;
  reason: string;
  amount?: number; // For partial refunds
}

/**
 * Refund result DTO
 */
export class RefundResultDto {
  success: boolean;
  refundId: string;
  originalPaymentId: string;
  amount: number;
  status: PaymentStatus;
  message: string;
}

/**
 * Bank account validation DTO
 */
export class BankAccountValidationDto {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
}

/**
 * Bank account validation result
 */
export class BankAccountValidationResultDto {
  valid: boolean;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  message?: string;
}

/**
 * Payment statistics DTO
 */
export class PaymentStatsDto {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number; // percentage
  topPaymentMethod: PaymentMethod;
  paymentsByMethod: {
    method: PaymentMethod;
    count: number;
    totalAmount: number;
  }[];
}

/**
 * Bulk payment status DTO
 */
export class BulkPaymentStatusDto {
  processed: number;
  successful: number;
  failed: number;
  pending: number;
  details: {
    txRef: string;
    status: PaymentStatus;
    amount: number;
    failureReason?: string;
  }[];
}
