import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@qalnet/shared-types';

@Controller('api/v1/wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(private readonly walletService: WalletService) {}

    @Get('me')
    async getBalance(@CurrentUser() user: JwtPayload) {
        return this.walletService.getBalance(user.sub);
    }

    @Get('me/transactions')
    async getTransactions(@CurrentUser() user: JwtPayload) {
        return this.walletService.getTransactions(user.sub);
    }

    @Post('deposit')
    async deposit(@CurrentUser() user: JwtPayload, @Body() dto: { amount: number }) {
        if (!dto || typeof dto.amount !== 'number' || dto.amount <= 0) {
            throw new BadRequestException('A positive numeric amount is required');
        }
        return this.walletService.deposit(user.sub, dto.amount);
    }

    @Post('withdraw')
    async withdraw(
        @CurrentUser() user: JwtPayload,
        @Body() dto: { amount: number; method?: string; phone?: string },
    ) {
        if (!dto || typeof dto.amount !== 'number' || dto.amount <= 0) {
            throw new BadRequestException('A positive numeric amount is required');
        }
        return this.walletService.withdraw(user.sub, dto.amount, dto.method);
    }
}
