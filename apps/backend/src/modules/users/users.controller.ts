import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@qalnet/shared-types';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    async getProfile(@CurrentUser() user: JwtPayload) {
        return this.usersService.getProfile(user.sub);
    }

    @Patch('me')
    async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: any) {
        return this.usersService.updateProfile(user.sub, dto);
    }
}
