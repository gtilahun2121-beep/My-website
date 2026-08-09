/**
 * two-factor.dto.ts
 *
 * DTOs for the TOTP two-factor authentication flows:
 *  - POST /api/v1/auth/2fa/verify   (verify setup code, enables 2FA)
 *  - POST /api/v1/auth/2fa/disable  (disable with a current code)
 *  - POST /api/v1/auth/verify-2fa   (second step of login)
 */

import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorCodeDto {
    @ApiProperty({
        description: '6-digit TOTP code or an XXXX-XXXX backup code',
        example: '123456',
    })
    @IsString()
    @IsNotEmpty({ message: 'code is required' })
    @MinLength(6, { message: 'code must be at least 6 characters' })
    @MaxLength(20, { message: 'code must not exceed 20 characters' })
    @Matches(/^[A-Za-z0-9-]+$/, { message: 'code contains invalid characters' })
    code: string;
}

export class TwoFactorLoginDto {
    @ApiProperty({
        description: 'Short-lived MFA token returned by /auth/login when 2FA is required',
    })
    @IsString()
    @IsNotEmpty({ message: 'mfa_token is required' })
    mfa_token: string;

    @ApiProperty({
        description: '6-digit TOTP code or an XXXX-XXXX backup code',
        example: '123456',
    })
    @IsString()
    @IsNotEmpty({ message: 'code is required' })
    @MinLength(6, { message: 'code must be at least 6 characters' })
    @MaxLength(20, { message: 'code must not exceed 20 characters' })
    @Matches(/^[A-Za-z0-9-]+$/, { message: 'code contains invalid characters' })
    code: string;
}
