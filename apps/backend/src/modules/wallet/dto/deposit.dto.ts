/**
 * deposit.dto.ts
 *
 * Validates POST /api/v1/wallets/deposit.
 * A PIN is required so wallet deposits are authorized by the account holder.
 */

import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DepositDto {
    @ApiProperty({ description: 'Amount to deposit into the wallet, in ETB' })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ description: 'Account PIN used to authorize the deposit' })
    @IsString()
    @MinLength(4)
    pin: string;
}