import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { EqubsService } from './equbs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserProfile } from '@qalnet/shared-types';

@Controller('api/v1/equbs')
@UseGuards(JwtAuthGuard)
export class EqubsController {
    constructor(private readonly equbsService: EqubsService) {}

    @Get()
    async listEqubs() {
        return this.equbsService.findAll();
    }

    @Get(':id')
    async getEqub(@Param('id') id: string) {
        return this.equbsService.findById(id);
    }

    @Post()
    async createEqub(@CurrentUser() user: UserProfile, @Body() dto: any) {
        return this.equbsService.create(user.id, dto);
    }

    @Post(':id/join')
    async joinEqub(@CurrentUser() user: UserProfile, @Param('id') id: string) {
        return this.equbsService.join(id, user.id);
    }
}
