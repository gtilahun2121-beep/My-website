/**
 * checkout.dto.ts
 *
 * Validates POST /api/v1/payments/checkout
 * Initiates a manual payment link or wallet deduction checkout.
 */

import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
    WALLET = 'wallet',
    CHAPA = 'chapa',
    TELEBIRR = 'telebirr',
}

export class CheckoutDto {
    @ApiProperty({ description: 'The Equb group ID to pay into' })
    @IsUUID()
    @IsNotEmpty()
    equb_id: string;

    @ApiProperty({ description: 'The round number this payment is for' })
    @IsNumber()
    @IsPositive()
    round_number: number;

    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.WALLET })
    @IsEnum(PaymentMethod)
    payment_method: PaymentMethod;

    @ApiPropertyOptional({
        description: 'Callback URL for Chapa/Telebirr redirect after payment',
    })
    @IsOptional()
    @IsString()
    callback_url?: string;
}
