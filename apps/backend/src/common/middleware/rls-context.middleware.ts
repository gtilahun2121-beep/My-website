/**
 * rls-context.middleware.ts
 *
 * Dynamic RLS context injection middleware.
 *
 * Reads the JWT from the Authorization header (if present) and stores
 * the decoded user ID and role in request-scoped variables.
 * These values are later consumed by withRlsContext() in repository methods
 * to inject app.current_user_id and app.current_user_role into Postgres
 * session variables for RLS enforcement.
 *
 * This middleware runs on every request — it does NOT verify the JWT
 * (that is done by JwtAuthGuard). It only extracts claims for logging
 * and context passing purposes.
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
    private readonly logger = new Logger(RlsContextMiddleware.name);

    use(req: Request & { rlsUserId?: string; rlsUserRole?: string }, res: Response, next: NextFunction): void {
        const authHeader = req.headers['authorization'];

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);

            try {
                // Decode without verifying — verification happens in JwtAuthGuard
                // We only need the claims for middleware context
                const payloadBase64 = token.split('.')[1];
                const payload = JSON.parse(
                    Buffer.from(payloadBase64, 'base64url').toString('utf-8'),
                );

                req.rlsUserId = payload.sub;
                req.rlsUserRole = payload.role;
            } catch {
                // Malformed token — let JwtAuthGuard handle the 401
                this.logger.debug('Could not decode JWT in RLS middleware — skipping.');
            }
        }

        next();
    }
}
