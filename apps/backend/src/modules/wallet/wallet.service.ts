import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { WalletRepository } from './wallet.repository';
import { RlsContext } from '../../config/database.config';

@Injectable()
export class WalletService {
    constructor(private readonly repo: WalletRepository) {}

    async getBalance(userId: string) {
        const wallet = await this.repo.findByUserId(userId);
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
    }

    async getTransactions(userId: string) {
        return this.repo.getTransactions(userId);
    }

    async deposit(userId: string, amount: number) {
        const ctx: RlsContext = { userId, userRole: 'participant' };
        const wallet = await this.repo.deposit(userId, amount, `DEP-${uuidv4()}`, ctx);
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
    }

    async withdraw(userId: string, amount: number, method?: string) {
        const ctx: RlsContext = { userId, userRole: 'participant' };
        const methodLabel = method?.trim() || 'bank_transfer';
        const wallet = await this.repo.withdraw(
            userId,
            amount,
            `WDR-${methodLabel}-${uuidv4()}`,
            ctx,
        );
        if (!wallet) {
            throw new BadRequestException(
                'Withdrawal failed: wallet not found or insufficient balance.',
            );
        }
        return wallet;
    }
}
