/**
 * register.dto.ts
 *
 * Validates the body of POST /api/v1/auth/register.
 * Maps exactly to the users table columns.
 */

import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({
        description: 'Ethiopian phone number in E.164 format',
        example: '+251911000000',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+251[79]\d{8}$/, {
        message: 'phone must be a valid Ethiopian number in E.164 format (+251...)',
    })
    phone: string;

    @ApiProperty({ example: 'user@qalnet.et' })
    @IsEmail({}, { message: 'email must be a valid email address' })
    @MaxLength(255)
    email: string;

    @ApiProperty({
        description: 'Password — min 8 chars, must contain a number and a letter',
        example: 'Secure123!',
    })
    @IsString()
    @MinLength(8, { message: 'password must be at least 8 characters' })
    @MaxLength(72, { message: 'password must not exceed 72 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
        message: 'password must contain at least one letter and one number',
    })
    password: string;

    @ApiPropertyOptional({ example: '@dawit_eth' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    telegram_handle?: string;
}
