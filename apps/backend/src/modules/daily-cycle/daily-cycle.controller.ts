/**
 * daily-cycle.controller.ts
 *
 * Read + operational endpoints for the Daily Equb cycle engine.
 *
 *  GET /api/v1/daily-cycles/:equbId/state   → current window/cycle state
 *  POST /api/v1/daily-cycles/:equbId/run    → force-run this equb's cutoff (host/admin)
 *  POST /api/v1/daily-cycles/run-due        → process every due daily equb (admin)
 */

import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { DailyCycleService } from './daily-cycle.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@Controller('api/v1/daily-cycles')
@UseGuards(JwtAuthGuard)
export class DailyCycleController {
    constructor(private readonly service: DailyCycleService) {}

    @Get(':equbId/state')
    @HttpCode(HttpStatus.OK)
    async getState(@Param('equbId') equbId: string) {
        return this.service.getState(equbId);
    }

    @Post('run-due')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @HttpCode(HttpStatus.OK)
    async runDue(@Body() body: { force?: boolean }) {
        return this.service.runAllDailyCutoffs(Boolean(body?.force));
    }

    @Post(':equbId/run')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @HttpCode(HttpStatus.OK)
    async runEqub(
        @CurrentUser() _user: JwtPayload,
        @Param('equbId') equbId: string,
    ) {
        return this.service.runDailyCutoff(equbId);
    }
}
