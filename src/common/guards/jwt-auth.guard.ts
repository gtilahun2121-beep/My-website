/**
 * jwt-auth.guard.ts
 *
 * A thin wrapper around Passport's AuthGuard('jwt').
 * Apply this guard to any controller or route that requires
 * a valid, unexpired RS256 JWT:
 *
 *   @UseGuards(JwtAuthGuard)
 *
 * Returns 401 Unauthorized if the token is missing, expired, or invalid.
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
