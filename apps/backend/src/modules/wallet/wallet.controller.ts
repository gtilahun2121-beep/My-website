import { BadRequestException, Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@qalnet/shared-types';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';

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
    async deposit(@CurrentUser() user: JwtPayload, @Body() dto: DepositDto) {
        return this.walletService.deposit(user.sub, dto.amount, dto.pin);
    }

    @Post('verify-pin')
    async verifyPin(@CurrentUser() user: JwtPayload, @Body() dto: { pin: string }) {
        if (!dto || !dto.pin) {
            throw new BadRequestException('PIN is required');
        }
        return this.walletService.verifyPin(user.sub, dto.pin);
    }

    @Post('withdraw')
    async withdraw(@CurrentUser() user: JwtPayload, @Body() dto: WithdrawDto) {
        return this.walletService.withdraw(
            user.sub,
            dto.amount,
            dto.method,
            dto.phone,
            dto.pin,
        );
    }
}