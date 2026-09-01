/**
 * weekly-cycle.controller.ts
 *
 * Read + operational endpoints for the Weekly Equb cycle engine.
 *
 *  GET /api/v1/weekly-cycles/:equbId/state    → current weekly window/cycle state
 *  POST /api/v1/weekly-cycles/:equbId/run     → force-run this equb's weekly cutoff (host/admin)
 *  POST /api/v1/weekly-cycles/run-due         → process every due weekly equb (admin)
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
import { WeeklyCycleService } from './weekly-cycle.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@Controller('api/v1/weekly-cycles')
@UseGuards(JwtAuthGuard)
export class WeeklyCycleController {
    constructor(private readonly service: WeeklyCycleService) {}

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
        return this.service.runAllWeeklyCutoffs(Boolean(body?.force));
    }

    @Post(':equbId/run')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('host', 'admin')
    @HttpCode(HttpStatus.OK)
    async runEqub(
        @CurrentUser() _user: JwtPayload,
        @Param('equbId') equbId: string,
    ) {
        return this.service.runWeeklyCutoff(equbId);
    }
}
