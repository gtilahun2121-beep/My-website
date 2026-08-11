/**
 * verify-fayda.dto.ts
 *
 * Validates the body of POST /api/v1/auth/verify-fayda.
 * Checks a Fayda national ID number against the real database before
 * it is used during registration.
 */

import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyFaydaDto {
    @ApiProperty({ description: '16-digit Fayda national ID number', example: '1234567890123456' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{16}$/, { message: 'fayda_id must be exactly 16 digits' })
    fayda_id: string;
}
