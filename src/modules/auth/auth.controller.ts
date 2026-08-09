/**
 * auth.controller.ts
 *
 * Handles all authentication HTTP endpoints under /api/v1/auth.
 *
 * Endpoints (from spec §2.1):
 *  POST /api/v1/auth/register  → 201 Created | 400 Bad Request | 409 Conflict
 *  POST /api/v1/auth/login     → 200 OK      | 400 Bad Request | 401 Unauthorized
 *  POST /api/v1/auth/refresh   → 200 OK      | 401 Unauthorized
 *  POST /api/v1/auth/logout    → 200 OK      | 401 Unauthorized
 *
 * Token delivery:
 *  - access_token  → JSON response body (short-lived, 15m)
 *  - refresh_token → HttpOnly Secure SameSite=Strict cookie (7d)
 *    Browser clients use the cookie automatically.
 *    Non-browser clients (USSD, mobile) may read refresh_token from body.
 */

import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './auth.service';

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const REFRESH_COOKIE_NAME = 'qalnet_refresh';

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/v1/auth',           // scope cookie to auth routes only
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    // ── Register ──────────────────────────────────────────────────────────────

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new participant account' })
    @ApiResponse({ status: 201, description: 'Account created successfully.' })
    @ApiResponse({ status: 400, description: 'Validation error.' })
    @ApiResponse({ status: 409, description: 'Phone or email already in use.' })
    async register(
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: RegisterDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.register(dto);
        this.setRefreshCookie(res, tokens.refresh_token);

        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token, // also in body for non-browser clients
            token_type: 'Bearer',
        };
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with phone/email + password' })
    @ApiResponse({ status: 200, description: 'Login successful.' })
    @ApiResponse({ status: 400, description: 'Validation error.' })
    @ApiResponse({ status: 401, description: 'Invalid credentials.' })
    async login(
        @Body(new ValidationPipe({ whitelist: true }))
        dto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.login(dto);
        this.setRefreshCookie(res, tokens.refresh_token);

        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: 'Bearer',
        };
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Rotate access + refresh tokens',
        description:
            'Browser clients send the refresh token automatically via HttpOnly cookie. ' +
            'Mobile/USSD clients can pass it in the request body.',
    })
    @ApiResponse({ status: 200, description: 'Tokens rotated.' })
    @ApiResponse({ status: 401, description: 'Refresh token invalid or expired.' })
    async refresh(
        @Req() req: Request,
        @Body(new ValidationPipe({ whitelist: true }))
        dto: RefreshTokenDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        // Prefer the HttpOnly cookie; fall back to body for non-browser clients
        const incomingToken: string | undefined =
            req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refresh_token;

        if (!incomingToken) {
            throw new UnauthorizedException('No refresh token provided.');
        }

        // Decode without verifying to extract the subject (user ID)
        // Full verification happens inside refreshTokens()
        let userId: string;
        try {
            const parts = incomingToken.split('.');
            if (parts.length !== 3) {
                throw new Error('Not a valid JWT structure');
            }
            const decoded = JSON.parse(
                Buffer.from(parts[1], 'base64url').toString(),
            ) as JwtPayload;
            if (!decoded?.sub) {
                throw new Error('Missing sub claim');
            }
            userId = decoded.sub;
        } catch {
            throw new UnauthorizedException('Malformed refresh token.');
        }

        const tokens = await this.authService.refreshTokens(userId, incomingToken);
        this.setRefreshCookie(res, tokens.refresh_token);

        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: 'Bearer',
        };
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke refresh token and end session' })
    @ApiResponse({ status: 200, description: 'Logged out successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async logout(
        @CurrentUser() user: JwtPayload,
        @Res({ passthrough: true }) res: Response,
    ) {
        await this.authService.logout(user.sub);

        // Clear the HttpOnly cookie
        res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });

        return { message: 'Logged out successfully.' };
    }

    // ── Private Helper ────────────────────────────────────────────────────────

    private setRefreshCookie(res: Response, refreshToken: string): void {
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    }
}
