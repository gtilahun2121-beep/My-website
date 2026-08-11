/**
 * reset-pin.dto.ts
 *
 * Validates the body of POST /api/v1/auth/reset-pin.
 * Completes a PIN reset after the OTP has been verified.
 * Mirrors the admin ResetPinDto password rules so a padded PIN
 * ("1234QN1234!") or a full password both validate.
 */

import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPinDto {
    @ApiProperty({ description: 'Registered phone number', example: '+251911000000' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ description: '6-digit one-time code', example: '483920' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
    otp: string;

    @ApiProperty({
        description: 'New PIN/password — min 8 chars, must contain a letter and a number',
        example: '1234QN1234!',
    })
    @IsString()
    @MinLength(8, { message: 'new_pin must be at least 8 characters' })
    @MaxLength(72, { message: 'new_pin must not exceed 72 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
        message: 'new_pin must contain at least one letter and one number',
    })
    new_pin: string;
}
