/**
 * webhook.dto.ts
 *
 * Validates POST /api/v1/payments/webhook
 * Ingests secure callbacks from Chapa and Telebirr payment processors.
 *
 * Both processors send a status field and a transaction reference.
 * The full raw body is preserved for HMAC signature verification.
 */

import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WebhookProcessor {
    CHAPA = 'chapa',
    TELEBIRR = 'telebirr',
}

export enum WebhookStatus {
    SUCCESS = 'success',
    FAILED = 'failed',
    PENDING = 'pending',
}

export class WebhookDto {
    @ApiProperty({ enum: WebhookProcessor })
    @IsEnum(WebhookProcessor)
    processor: WebhookProcessor;

    @ApiProperty({ description: 'Unique transaction reference from the processor' })
    @IsString()
    @IsNotEmpty()
    tx_ref: string;

    @ApiProperty({ enum: WebhookStatus })
    @IsEnum(WebhookStatus)
    status: WebhookStatus;

    @ApiPropertyOptional({ description: 'Amount confirmed by processor' })
    @IsOptional()
    amount?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    currency?: string;
}
