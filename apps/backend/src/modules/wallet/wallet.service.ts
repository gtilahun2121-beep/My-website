import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
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

    /**
     * Deposits funds. Requires the account PIN so only the account holder can
     * move money into the wallet.
     */
    async deposit(userId: string, amount: number, pin: string) {
        const ctx: RlsContext = { userId, userRole: 'participant' };
        await this.verifyPin(userId, pin, ctx);
        const wallet = await this.repo.deposit(userId, amount, `DEP-${uuidv4()}`, ctx);
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
    }

    async withdraw(userId: string, amount: number, method?: string) {
        const ctx: RlsContext = { userId, userRole: 'participant' };
        await this.verifyPin(userId, pin ?? '', ctx);

        const methodCode = normalizeWithdrawMethod(method);
        const phonePart = sanitizeReferencePart(phone);
        const reference = phonePart
            ? `WDR-${methodCode}-${phonePart}-${uuidv4()}`
            : `WDR-${methodCode}-${uuidv4()}`;

        const wallet = await this.repo.withdraw(userId, amount, reference, ctx);
        if (!wallet) {
            throw new BadRequestException(
                'Withdrawal failed: wallet not found or insufficient balance.',
            );
        }
        return wallet;
    }
}
