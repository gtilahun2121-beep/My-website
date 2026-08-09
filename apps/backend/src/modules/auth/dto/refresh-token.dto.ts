/**
 * refresh-token.dto.ts
 *
 * Used by POST /api/v1/auth/refresh.
 * The refresh token is read from the HttpOnly cookie by the guard,
 * but this DTO handles the rare case of explicit body submission
 * (e.g. USSD or mobile clients that cannot use cookies).
 */

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
    @ApiPropertyOptional({
        description:
            'Refresh token — only required for non-browser clients. ' +
            'Browser clients send it automatically via HttpOnly cookie.',
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    refresh_token?: string;
}
