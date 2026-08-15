/**
 * login.dto.ts
 *
 * Validates the body of POST /api/v1/auth/login.
 * Supports both phone and email as the identifier.
 */

import {
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        description: 'Ethiopian phone number OR email address',
        example: '+251911000000',
    })
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @ApiProperty({ example: 'Secure123!' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(72)
    password: string;
}
