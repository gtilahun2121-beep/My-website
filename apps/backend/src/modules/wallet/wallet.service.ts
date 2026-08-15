import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { WalletRepository } from './wallet.repository';
import { RlsContext } from '../../config/database.config';
import { VaultConfig } from '../../config/vault.config';

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

    async verifyPin(userId: string, pin?: string): Promise<{ verified: boolean }> {
        if (!pin) {
            throw new BadRequestException('PIN is required');
        }
        const secrets = await VaultConfig.load();
        const passwordHash = await this.repo.findPasswordHash(userId);
        if (!passwordHash) {
            throw new BadRequestException('Account PIN not found. Please reset your PIN.');
        }
        const isPinValid = await argon2.verify(passwordHash, pin + secrets.ARGON2_PEPPER);
        if (!isPinValid) {
            throw new BadRequestException('Incorrect PIN. Please try again.');
        }
        return { verified: true };
    }

    async withdraw(userId: string, amount: number, method?: string, phone?: string, pin?: string) {
        // Validate PIN presence
        if (!pin) {
            throw new BadRequestException('PIN is required');
        }

        // Verify PIN against the user's registered PIN (argon2 hash of the PIN)
        const secrets = await VaultConfig.load();
        const passwordHash = await this.repo.findPasswordHash(userId);
        if (!passwordHash) {
            throw new BadRequestException('Account PIN not found. Please reset your PIN.');
        }
        const isPinValid = await argon2.verify(passwordHash, pin + secrets.ARGON2_PEPPER);
        if (!isPinValid) {
            throw new BadRequestException('Incorrect PIN. Please try again.');
        }

        // Validate amount
        if (!amount || amount <= 0) {
            throw new BadRequestException('Withdrawal amount must be greater than zero.');
        }

        // Validate account number for Ethiopian National Bank
        if (method === 'et_national_bank' || method === 'ethiopian_national_bank') {
            if (!phone || !/^\d{13}$/.test(phone) || !phone.startsWith('1000')) {
                throw new BadRequestException(
                    'Account number must be 13 digits and start with 1000 for Ethiopian National Bank. This account does not exist.',
                );
            }
        }

        // Validate Telebirr phone number
        if (method === 'telebirr') {
            if (!phone || !/^\+251\d{9}$/.test(phone)) {
                throw new BadRequestException('Valid Telebirr phone number required (format: +2519XXXXXXX)');
            }
        }

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