import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserProfile } from '@qalnet/shared-types';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    async getProfile(@CurrentUser() user: UserProfile) {
        return this.usersService.getProfile(user.id);
    }

    @Patch('me')
    async updateProfile(@CurrentUser() user: UserProfile, @Body() dto: any) {
        return this.usersService.updateProfile(user.id, dto);
    }
}
