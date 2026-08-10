/**
 * reset-pin.dto.ts
 *
 * Validates the body of POST /api/v1/admin/users/:id/reset-pin.
 * Mirrors the RegisterDto password rules so a padded PIN ("1234QN1234!")
 * or a full password both validate.
 */

import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPinDto {
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
