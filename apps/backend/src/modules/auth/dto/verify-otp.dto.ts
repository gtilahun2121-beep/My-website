/**
 * verify-otp.dto.ts
 *
 * Validates the body of POST /api/v1/auth/verify-otp.
 * Confirms an OTP previously issued to the given phone.
 */

import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
    @ApiProperty({ description: 'Phone number the OTP was issued to', example: '+251911000000' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ description: '6-digit one-time code', example: '483920' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
    otp: string;
}
