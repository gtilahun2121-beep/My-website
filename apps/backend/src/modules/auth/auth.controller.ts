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
    Get,
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
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto, TwoFactorLoginDto } from './dto/two-factor.dto';
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

    // ── Availability pre-check ────────────────────────────────────────────────

    @Post('check-availability')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Check if an email and/or phone is already registered' })
    @ApiResponse({ status: 200, description: 'Availability result.' })
    @ApiResponse({ status: 400, description: 'Neither email nor phone provided.' })
    async checkAvailability(
        @Body(new ValidationPipe({ whitelist: true }))
        dto: CheckAvailabilityDto,
    ) {
        return this.authService.checkAvailability(dto);
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
        const result = await this.authService.login(dto);

        // 2FA step required — do NOT issue tokens or set the refresh cookie yet.
        if ('two_factor_required' in result) {
            return {
                two_factor_required: true,
                mfa_token: result.mfa_token,
            };
        }

        this.setRefreshCookie(res, result.refresh_token);

        return {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
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
            const decoded = JSON.parse(
                Buffer.from(incomingToken.split('.')[1], 'base64url').toString(),
            ) as JwtPayload;
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

    // ── Password / PIN change ─────────────────────────────────────────────────

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change PIN/password after verifying the current one' })
    @ApiResponse({ status: 200, description: 'Password changed.' })
    @ApiResponse({ status: 400, description: 'Validation error.' })
    @ApiResponse({ status: 401, description: 'Current PIN incorrect.' })
    async changePassword(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(user.sub, dto);
    }

    // ── Two-factor authentication (TOTP) ──────────────────────────────────────

    @Post('2fa/setup')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Generate a TOTP secret + otpauth URL for the QR code' })
    async setupTwoFactor(@CurrentUser() user: JwtPayload) {
        return this.authService.setupTwoFactor(user.sub);
    }

    @Post('2fa/verify')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify the setup code and enable 2FA' })
    async verifyTwoFactorSetup(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: TwoFactorCodeDto,
    ) {
        return this.authService.verifyTwoFactorSetup(user.sub, dto);
    }

    @Post('2fa/disable')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Disable 2FA after verifying a current code' })
    async disableTwoFactor(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: TwoFactorCodeDto,
    ) {
        return this.authService.disableTwoFactor(user.sub, dto);
    }

    @Get('2fa/status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Current 2FA status' })
    async twoFactorStatus(@CurrentUser() user: JwtPayload) {
        return this.authService.getTwoFactorStatus(user.sub);
    }

    // ── Second step of login when 2FA is enabled ─────────────────────────────

    @Post('verify-2fa')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Complete login with a TOTP/backup code' })
    @ApiResponse({ status: 200, description: 'Tokens issued.' })
    @ApiResponse({ status: 401, description: 'Invalid or expired code / MFA token.' })
    async verifyTwoFactorLogin(
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: TwoFactorLoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.verifyTwoFactorLogin(dto);
        this.setRefreshCookie(res, tokens.refresh_token);

        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: 'Bearer',
        };
    }

    // ── Stubs ─────────────────────────────────────────────────────────────────

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Stub for OTP verification' })
    async verifyOtp() {
        return { verified: true };
    }

    @Post('verify-fayda')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Stub for Fayda verification' })
    async verifyFayda() {
        return { verified: true };
    }

    @Post('forgot-pin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Stub for forgot PIN' })
    async forgotPin() {
        return { success: true };
    }

    @Post('reset-pin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Stub for reset PIN' })
    async resetPin() {
        return { success: true };
    }

    // ── Private Helper ────────────────────────────────────────────────────────

    private setRefreshCookie(res: Response, refreshToken: string): void {
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    }
}
