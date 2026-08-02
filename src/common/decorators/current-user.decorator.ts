/**
 * current-user.decorator.ts
 *
 * Parameter decorator that extracts the authenticated user's JWT payload
 * from the request object — set by JwtStrategy.validate().
 *
 * Usage:
 *   async someRoute(@CurrentUser() user: JwtPayload) { ... }
 *   async someRoute(@CurrentUser('sub') userId: string) { ... }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/auth.service';

export const CurrentUser = createParamDecorator(
    (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
        const user = request.user;
        return field ? user?.[field] : user;
    },
);
