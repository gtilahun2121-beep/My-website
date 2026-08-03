/**
 * logging.interceptor.ts
 *
 * Global interceptor that:
 *  1. Logs every incoming request (method, path, user ID if authenticated)
 *  2. Catches all unhandled exceptions and logs them with context
 *  3. Measures response time and logs slow requests (> 1000ms)
 */

import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { JwtPayload } from '../../modules/auth/auth.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
        const res = context.switchToHttp().getResponse<Response>();
        const { method, url } = req;
        const userId = req.user?.sub ?? 'anonymous';
        const start = Date.now();

        return next.handle().pipe(
            tap(() => {
                const ms = Date.now() - start;
                const statusCode = res.statusCode;

                if (ms > 1000) {
                    this.logger.warn(
                        `SLOW ${method} ${url} [${statusCode}] ${ms}ms — user: ${userId}`,
                    );
                } else {
                    this.logger.log(
                        `${method} ${url} [${statusCode}] ${ms}ms — user: ${userId}`,
                    );
                }
            }),
            catchError((err) => {
                const ms = Date.now() - start;
                this.logger.error(
                    `${method} ${url} ERROR ${ms}ms — user: ${userId} — ${err.message}`,
                    err.stack,
                );
                return throwError(() => err);
            }),
        );
    }
}
