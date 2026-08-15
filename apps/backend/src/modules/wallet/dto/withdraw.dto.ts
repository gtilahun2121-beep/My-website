/**
 * withdraw.dto.ts
 *
 * Validates POST /api/v1/wallets/withdraw.
 *
 * The withdrawal method is OPTIONAL and applies to ALL supported channels:
 * telebirr, cbe, abyssinia, dashen, awash, nib (or a custom bank transfer).
 * A PIN is required to authorize the money movement.
 */

import {
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDto {
    @ApiProperty({ description: 'Amount to withdraw from the wallet, in ETB' })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ description: 'Account PIN used to authorize the withdrawal' })
    @IsString()
    @MinLength(4)
    pin: string;

    @ApiPropertyOptional({
        description:
            'Withdrawal channel — telebirr | cbe | abyssinia | dashen | awash | nib, or any custom label',
    })
    @IsOptional()
    @IsString()
    method?: string;

    @ApiPropertyOptional({
        description: 'Destination phone / account number for the withdrawal',
    })
    @IsOptional()
    @IsString()
    phone?: string;
}