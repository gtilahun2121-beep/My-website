import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import {
    WalletService,
    normalizeWithdrawMethod,
} from './wallet.service';
import { WalletRepository } from './wallet.repository';

jest.mock('uuid', () => ({
    v4: () => '00000000-0000-4000-8000-000000000000',
}));

jest.mock('argon2', () => ({
    verify: jest.fn(),
}));

jest.mock('../../config/vault.config', () => ({
    VaultConfig: {
        load: jest.fn().mockResolvedValue({ ARGON2_PEPPER: 'test-pepper' }),
    },
}));

const USER = { id: 'user-1', password_hash: '$argon2id$hash' };

function makeRepoMock() {
    return {
        findByUserId: jest.fn(),
        getTransactions: jest.fn(),
        getUserAuth: jest.fn(),
        deposit: jest.fn(),
        withdraw: jest.fn(),
    };
}

describe('normalizeWithdrawMethod', () => {
    it('maps all supported channel names to their codes', () => {
        expect(normalizeWithdrawMethod('telebirr')).toBe('telebirr');
        expect(normalizeWithdrawMethod('CBE')).toBe('cbe');
        expect(normalizeWithdrawMethod('Abyssinia Bank')).toBe('abyssinia');
        expect(normalizeWithdrawMethod('Dashen Bank')).toBe('dashen');
        expect(normalizeWithdrawMethod('awash')).toBe('awash');
        expect(normalizeWithdrawMethod('NIB International Bank')).toBe('nib');
    });

    it('falls back to bank_transfer for unknown or missing methods', () => {
        expect(normalizeWithdrawMethod()).toBe('bank_transfer');
        expect(normalizeWithdrawMethod('crypto')).toBe('bank_transfer');
        expect(normalizeWithdrawMethod('   ')).toBe('bank_transfer');
    });
});

describe('WalletService.deposit', () => {
    let repo: ReturnType<typeof makeRepoMock>;
    let service: WalletService;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new WalletService(repo as unknown as WalletRepository);
        repo.getUserAuth.mockResolvedValue(USER);
        repo.deposit.mockResolvedValue({
            id: 'w-1',
            user_id: 'user-1',
            balance: 1500,
            currency: 'ETB',
        });
    });

    it('requires a valid PIN before crediting the wallet', async () => {
        (argon2.verify as jest.Mock).mockResolvedValue(true);

        const result = await service.deposit('user-1', 1000, '1234');

        expect(repo.deposit).toHaveBeenCalledWith(
            'user-1',
            1000,
            'DEP-00000000-0000-4000-8000-000000000000',
            { userId: 'user-1', userRole: 'participant' },
        );
        expect(result.balance).toBe(1500);
    });

    it('rejects a wrong PIN without touching the wallet', async () => {
        (argon2.verify as jest.Mock).mockResolvedValue(false);

        await expect(service.deposit('user-1', 1000, '9999')).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
        expect(repo.deposit).not.toHaveBeenCalled();
    });

    it('peppers the PIN exactly as at login', async () => {
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        await service.deposit('user-1', 100, '0000');
        expect(argon2.verify).toHaveBeenCalledWith(
            '$argon2id$hash',
            '0000test-pepper',
        );
    });
});

describe('WalletService.withdraw', () => {
    let repo: ReturnType<typeof makeRepoMock>;
    let service: WalletService;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new WalletService(repo as unknown as WalletRepository);
        repo.getUserAuth.mockResolvedValue(USER);
        repo.withdraw.mockResolvedValue({
            id: 'w-1',
            user_id: 'user-1',
            balance: 500,
            currency: 'ETB',
        });
        (argon2.verify as jest.Mock).mockResolvedValue(true);
    });

    it('withdraws to any supported method and records it in the reference', async () => {
        await service.withdraw('user-1', 500, 'abyssinia', '251911223344', '1234');

        expect(repo.withdraw).toHaveBeenCalledWith(
            'user-1',
            500,
            expect.stringMatching(/^WDR-abyssinia-251911223344-/),
            expect.anything(),
        );
    });

    it('normalizes method names (e.g. "Awash Bank") to their code', async () => {
        await service.withdraw('user-1', 200, 'Awash Bank', '+251911223344', '1234');

        const reference = (repo.withdraw as jest.Mock).mock.calls[0][2] as string;
        expect(reference).toMatch(/^WDR-awash-251911223344-/);
    });

    it('uses bank_transfer when no method is supplied', async () => {
        await service.withdraw('user-1', 100, undefined, '251911223344', '1234');
        const reference = (repo.withdraw as jest.Mock).mock.calls[0][2] as string;
        expect(reference).toMatch(/^WDR-bank_transfer-251911223344-/);
    });

    it('rejects a wrong PIN before deducting', async () => {
        (argon2.verify as jest.Mock).mockResolvedValue(false);
        await expect(
            service.withdraw('user-1', 100, 'telebirr', '251911223344', '0000'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(repo.withdraw).not.toHaveBeenCalled();
    });
});