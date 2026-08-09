/**
 * change-password.dto.ts
 *
 * Validates the body of POST /api/v1/auth/change-password.
 * The frontend sends PINs/passwords exactly as on register/login
 * (already padded), so the new password rules mirror RegisterDto.
 */

import {
    IsNotEmpty,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({
        description: 'Current PIN/password used to authenticate the change',
        example: '1234',
    })
    @IsString()
    @IsNotEmpty({ message: 'current_password is required' })
    @MaxLength(72)
    current_password: string;

    @ApiProperty({
        description: 'New PIN/password — min 8 chars, must contain a letter and a number',
        example: 'Secure123!',
    })
    @IsString()
    @MinLength(8, { message: 'new_password must be at least 8 characters' })
    @MaxLength(72, { message: 'new_password must not exceed 72 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
        message: 'new_password must contain at least one letter and one number',
    })
    new_password: string;
}
