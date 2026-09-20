/**
 * health.controller.ts
 *
 * Liveness endpoint used by the frontend health check and by the
 * Docker/Kubernetes readiness probes. The web app's healthAPI() calls
 * GET /api/v1/health, so the route must exist here.
 */

import { Controller, Get } from '@nestjs/common';
import { isDatabaseAvailable, isDatabaseStartupDegraded } from '../../config/database.config';

@Controller('api/v1/health')
export class HealthController {
    @Get()
    check() {
        const databaseAvailable = isDatabaseAvailable();

        return {
            status: databaseAvailable ? 'ok' : 'degraded',
            database: databaseAvailable ? 'connected' : 'unavailable',
            degraded: isDatabaseStartupDegraded(),
            timestamp: new Date().toISOString(),
        };
    }
}