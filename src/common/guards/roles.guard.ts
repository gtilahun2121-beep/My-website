/**
 * roles.guard.ts
 *
 * Enforces RBAC boundaries defined in spec §1.4.
 * Must be used AFTER JwtAuthGuard (which populates request.user).
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin', 'host')
 *   @Get('some-protected-route')
 *
 * If no @Roles() decorator is present, the guard allows all
 * authenticated users through.
 */

import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../../modules/auth/auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        // Collect roles from method-level then class-level decorators
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // No @Roles() decorator — allow any authenticated user
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('No authenticated user found.');
        }

        const hasRole = requiredRoles.includes(user.role);
        if (!hasRole) {
            throw new ForbiddenException(
                `Access denied. Required role(s): ${requiredRoles.join(', ')}.`,
            );
        }

        return true;
    }
}
