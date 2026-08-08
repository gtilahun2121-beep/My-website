import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletRepository } from './wallet.repository';

@Injectable()
export class WalletService {
    constructor(private readonly repo: WalletRepository) {}

    async getBalance(userId: string) {
        const wallet = await this.repo.findByUserId(userId);
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
    }

    async deposit(userId: string, amount: number) {
        return this.repo.addBalance(userId, amount);
    }
}
