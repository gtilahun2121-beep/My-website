/**
 * send-otp.dto.ts
 *
 * Validates the body of POST /api/v1/auth/send-otp.
 * Issues a verification OTP to a phone during signup (Fayda verification),
 * before the account exists.
 */

import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
    @ApiProperty({
        description: 'Phone number to send the verification code to (E.164)',
        example: '+251911000000',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+251[79]\d{8}$/, {
        message: 'phone must be a valid Ethiopian number in E.164 format (+251...)',
    })
    phone: string;
}
