import { Controller, Get, Post, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { EqubsService } from './equbs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@qalnet/shared-types';

@Controller('api/v1/equbs')
@UseGuards(JwtAuthGuard)
export class EqubsController {
    constructor(private readonly equbsService: EqubsService) {}

    @Get()
    async listEqubs() {
        return this.equbsService.findAll();
    }

    @Get('mine')
    async getMyEqubs(@CurrentUser() user: JwtPayload) {
        return this.equbsService.findMine(user.sub);
    }

    @Get(':id')
    async getEqub(@Param('id') id: string) {
        return this.equbsService.findById(id);
    }

    @Post()
    async createEqub(@CurrentUser() user: JwtPayload, @Body() dto: any) {
        const equb = this.equbsService.validateCreatePayload(dto);
        return this.equbsService.create(user.sub, equb);
    }

    @Post(':id/join')
    async joinEqub(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.equbsService.join(id, user.sub);
    }
}
