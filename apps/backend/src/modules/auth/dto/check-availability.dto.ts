/**
 * check-availability.dto.ts
 *
 * Validates the body of POST /api/v1/auth/check-availability.
 * At least one of `email` / `phone` must be provided.
 */

import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CheckAvailabilityDto {
    @ApiPropertyOptional({ example: 'user@example.com' })
    @IsOptional()
    @IsEmail({}, { message: 'email must be a valid email address' })
    @MaxLength(255)
    email?: string;

    @ApiPropertyOptional({
        description: 'Ethiopian phone number in E.164 format',
        example: '+251911000000',
    })
    @IsOptional()
    @IsString()
    @Matches(/^\+251[79]\d{8}$/, {
        message: 'phone must be a valid Ethiopian number in E.164 format (+251...)',
    })
    phone?: string;
}
