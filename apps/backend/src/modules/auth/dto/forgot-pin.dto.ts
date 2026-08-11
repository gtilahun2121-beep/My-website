/**
 * forgot-pin.dto.ts
 *
 * Validates the body of POST /api/v1/auth/forgot-pin.
 * Initiates a PIN reset by sending an OTP to the registered phone.
 */

import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPinDto {
    @ApiProperty({
        description: 'Registered Ethiopian phone number in E.164 format',
        example: '+251911000000',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+251[79]\d{8}$/, {
        message: 'phone must be a valid Ethiopian number in E.164 format (+251...)',
    })
    phone: string;
}
