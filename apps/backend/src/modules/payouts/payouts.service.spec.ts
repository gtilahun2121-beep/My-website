import { NotFoundException } from '@nestjs/common';

import { PayoutsService } from './payouts.service';
import { PayoutsRepository, PayoutRecord } from './payouts.repository';
import { PayoutProviderService } from './providers/payout-provider.service';

function makePayout(overrides: Partial<PayoutRecord> = {}): PayoutRecord {
    return {
        id: 'payout-1',
        equb_id: 'equb-1',
        round_number: 1,
        winner_id: 'alice',
        total_pot_amount: 2000,
        status: 'pending',
        provider: 'sandbox-bank',
        transaction_reference: null,
        requested_at: null,
        completed_at: null,
        failure_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
        ...overrides,
    };
}

function makeRepoMock() {
    return {
        getPayoutById: jest.fn(),
        transitionPayout: jest.fn(),
        setPayoutProcessing: jest.fn(),
        getWinnerDetails: jest.fn(),
        markPayoutSuccess: jest.fn(),
        markPayoutFailed: jest.fn(),
        holdForManualReview: jest.fn(),
        retryPayout: jest.fn(),
        getPayoutsByStatus: jest.fn(),
        createPayoutBatchRun: jest.fn(),
        completePayoutBatchRun: jest.fn(),
        linkPayoutToBatchRun: jest.fn(),
        listPayouts: jest.fn(),
    };
}

function makeProviderMock() {
    return {
        currentMode: 'sandbox',
        resolve: jest.fn().mockReturnValue({
            name: 'sandbox-bank',
            disburse: jest.fn(),
        }),
    };
}

const CONTEXT = { userId: 'system', userRole: 'admin' as const };

describe('PayoutsService.getPayout', () => {
    it('throws NotFoundException when the payout does not exist', async () => {
        const repo = makeRepoMock();
        const service = new PayoutsService(
            repo as unknown as PayoutsRepository,
            makeProviderMock() as unknown as PayoutProviderService,
        );
        repo.getPayoutById.mockResolvedValue(null);

        await expect(service.getPayout('nope')).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });
});

describe('PayoutsService.processPayout', () => {
    let repo: ReturnType<typeof makeRepoMock>;
    let providers: ReturnType<typeof makeProviderMock>;
    let service: PayoutsService;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        providers = makeProviderMock();
        service = new PayoutsService(
            repo as unknown as PayoutsRepository,
            providers as unknown as PayoutProviderService,
        );
        repo.setPayoutProcessing.mockResolvedValue(makePayout());
        repo.getWinnerDetails.mockResolvedValue({
            payout_id: 'payout-1',
            first_name: 'Alice',
            last_name: 'A',
            phone: '0911111111',
        });
    });

    it('marks the payout success only after the provider confirms', async () => {
        providers.resolve().disburse.mockResolvedValue({
            success: true,
            reference: 'BANK-xyz',
        });

        const result = await service.processPayout('payout-1', CONTEXT);

        expect(result.status).toBe('success');
        expect(result.reference).toBe('BANK-xyz');
        expect(repo.markPayoutSuccess).toHaveBeenCalledWith(
            'payout-1',
            'BANK-xyz',
            'sandbox-bank',
            CONTEXT,
        );
        expect(repo.markPayoutFailed).not.toHaveBeenCalled();
    });

    it('marks the payout failed when the provider rejects it', async () => {
        providers.resolve().disburse.mockResolvedValue({
            success: false,
            failureReason: 'Insufficient funds',
        });

        const result = await service.processPayout('payout-1', CONTEXT);

        expect(result.status).toBe('failed');
        expect(result.failure_reason).toBe('Insufficient funds');
        expect(repo.markPayoutFailed).toHaveBeenCalledWith(
            'payout-1',
            'Insufficient funds',
            CONTEXT,
        );
    });

    it('skips payouts that are already being processed elsewhere', async () => {
        repo.setPayoutProcessing.mockResolvedValue(null);
        repo.getPayoutById.mockResolvedValue(makePayout({ status: 'processing' }));

        const result = await service.processPayout('payout-1', CONTEXT);

        expect(result.status).toBe('skipped');
        expect(providers.resolve().disburse).not.toHaveBeenCalled();
    });

    it('holds for manual review when the winner details are missing', async () => {
        repo.getWinnerDetails.mockResolvedValue(null);

        const result = await service.processPayout('payout-1', CONTEXT);

        expect(result.status).toBe('manual_review');
        expect(repo.holdForManualReview).toHaveBeenCalledWith(
            'payout-1',
            'Winner account details not found.',
            CONTEXT,
        );
    });
});

describe('PayoutsService.processPendingPayouts', () => {
    let repo: ReturnType<typeof makeRepoMock>;
    let providers: ReturnType<typeof makeProviderMock>;
    let service: PayoutsService;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        providers = makeProviderMock();
        service = new PayoutsService(
            repo as unknown as PayoutsRepository,
            providers as unknown as PayoutProviderService,
        );
        repo.getPayoutsByStatus.mockResolvedValue([
            makePayout({ id: 'payout-1' }),
            makePayout({ id: 'payout-2' }),
        ]);
        repo.createPayoutBatchRun.mockResolvedValue({
            id: 'run-1',
            provider: 'sandbox-bank',
            total_amount: 4000,
            total_payouts: 2,
            status: 'processing',
            created_at: new Date(),
            completed_at: null,
        });
    });

    it('groups ready payouts into a batch run and confirms success', async () => {
        providers.resolve().disburse.mockResolvedValue({
            success: true,
            reference: 'BANK-xyz',
        });
        repo.setPayoutProcessing.mockImplementation(
            async (id: string) => makePayout({ id }),
        );
        repo.getWinnerDetails.mockResolvedValue({
            payout_id: 'payout-1',
            first_name: 'Alice',
            last_name: 'A',
            phone: '0911111111',
        });
        repo.markPayoutSuccess.mockImplementation(
            async (id: string) => makePayout({ id, status: 'success' }),
        );

        const result = await service.processPendingPayouts(CONTEXT);

        expect(result.processed).toBe(2);
        expect(result.succeeded).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.batch_run_id).toBe('run-1');
        expect(repo.createPayoutBatchRun).toHaveBeenCalledWith(
            'sandbox-bank',
            4000,
            2,
        );
        expect(repo.completePayoutBatchRun).toHaveBeenCalledWith('run-1', 'success');
        expect(repo.linkPayoutToBatchRun).toHaveBeenCalledTimes(2);
    });

    it('marks the batch run failed when any payout fails', async () => {
        providers.resolve().disburse
            .mockResolvedValueOnce({ success: true, reference: 'BANK-1' })
            .mockResolvedValueOnce({ success: false, failureReason: 'Rejected' });
        repo.setPayoutProcessing.mockImplementation(
            async (id: string) => makePayout({ id }),
        );
        repo.getWinnerDetails.mockResolvedValue({
            payout_id: 'payout-1',
            first_name: 'Alice',
            last_name: 'A',
            phone: '0911111111',
        });
        repo.markPayoutSuccess.mockImplementation(
            async (id: string) => makePayout({ id, status: 'success' }),
        );

        const result = await service.processPendingPayouts(CONTEXT);

        expect(result.succeeded).toBe(1);
        expect(result.failed).toBe(1);
        expect(repo.completePayoutBatchRun).toHaveBeenCalledWith('run-1', 'failed');
    });

    it('returns an empty result when nothing is ready', async () => {
        repo.getPayoutsByStatus.mockResolvedValue([]);

        const result = await service.processPendingPayouts(CONTEXT);

        expect(result.processed).toBe(0);
        expect(result.batch_run_id).toBeNull();
        expect(repo.createPayoutBatchRun).not.toHaveBeenCalled();
    });
});