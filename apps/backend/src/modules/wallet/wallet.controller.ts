import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserProfile } from '@qalnet/shared-types';

@Controller('api/v1/wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(private readonly walletService: WalletService) {}

    @Get('me')
    async getBalance(@CurrentUser() user: UserProfile) {
        return this.walletService.getBalance(user.id);
    }

    @Post('deposit')
    async deposit(@CurrentUser() user: UserProfile, @Body() dto: { amount: number }) {
        return this.walletService.deposit(user.id, dto.amount);
    }
}
