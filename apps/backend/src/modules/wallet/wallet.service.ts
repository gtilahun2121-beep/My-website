import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { WalletRepository } from './wallet.repository';
import { RlsContext } from '../../config/database.config';
import { VaultConfig } from '../../config/vault.config';

// ── Supported withdrawal channels ─────────────────────────────────────────
// Every channel listed in the frontend withdraw form is normalized to a
// stable code that is embedded in the transaction reference.
const WITHDRAW_METHOD_CODES: Record<string, string> = {
    telebirr: 'telebirr',
    'telebirr phone': 'telebirr',
    cbe: 'cbe',
    'commercial bank of ethiopia': 'cbe',
    abyssinia: 'abyssinia',
    'abyssinia bank': 'abyssinia',
    dashen: 'dashen',
    'dashen bank': 'dashen',
    awash: 'awash',
    'awash bank': 'awash',
    nib: 'nib',
    'nib international bank': 'nib',
};

export function normalizeWithdrawMethod(method?: string): string {
    if (!method) return 'bank_transfer';
    const key = method.trim().toLowerCase();
    return WITHDRAW_METHOD_CODES[key] ?? 'bank_transfer';
}

function sanitizeReferencePart(value?: string): string {
    return (value ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

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

    /**
     * Withdraws funds to any supported payment method. Requires the account
     * PIN. The channel (method) is normalized to a stable code and recorded
     * in the transaction reference alongside the destination phone.
     */
    async withdraw(
        userId: string,
        amount: number,
        method?: string,
        phone?: string,
        pin?: string,
    ) {
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

    /**
     * Verifies the supplied PIN against the account's Argon2id hash.
     * The PIN is peppered exactly as at registration/login.
     */
    private async verifyPin(userId: string, pin: string, ctx: RlsContext) {
        const secrets = await VaultConfig.load();
        const user = await this.repo.getUserAuth(userId, ctx);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isValid = await argon2.verify(
            user.password_hash,
            pin + secrets.ARGON2_PEPPER,
        );
        if (!isValid) {
            throw new UnauthorizedException('Invalid PIN.');
        }
    }
}