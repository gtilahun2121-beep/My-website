import { ReconciliationService } from './reconciliation.service';
import {
    ReconciliationRepository,
    ReconciliationPaymentRow,
} from './reconciliation.repository';

function makePayment(
    overrides: Partial<ReconciliationPaymentRow> = {},
): ReconciliationPaymentRow {
    return {
        id: 'p-1',
        user_id: 'u-1',
        equb_id: 'equb-1',
        round_number: 1,
        amount: 1000,
        payment_status: 'paid',
        transaction_reference: 'QAL-CHAPA-123-R1-456-AAAA',
        provider: 'chapa',
        paid_at: new Date(),
        created_at: new Date(),
        ...overrides,
    };
}

function makeRepoMock() {
    return {
        getRunByDate: jest.fn(),
        createRun: jest.fn(),
        completeRun: jest.fn(),
        addIssue: jest.fn(),
        getPaymentsForReconciliation: jest.fn(),
        listIssues: jest.fn(),
    };
}

describe('ReconciliationService.runReconciliation', () => {
    let repo: ReturnType<typeof makeRepoMock>;
    let service: ReconciliationService;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new ReconciliationService(
            repo as unknown as ReconciliationRepository,
        );
        repo.createRun.mockResolvedValue({
            id: 'run-1',
            run_date: '2026-08-15',
            status: 'running',
            missing_count: 0,
            duplicate_count: 0,
            failed_count: 0,
            unmatched_count: 0,
            amount_mismatch_count: 0,
            created_at: new Date(),
            completed_at: null,
        });
    });

    it('skips when the run for the date already completed', async () => {
        repo.getRunByDate.mockResolvedValue({
            id: 'run-1',
            run_date: '2026-08-15',
            status: 'completed',
            missing_count: 1,
            duplicate_count: 0,
            failed_count: 0,
            unmatched_count: 0,
            amount_mismatch_count: 0,
            created_at: new Date(),
            completed_at: new Date(),
        });

        const result = await service.runReconciliation(new Date('2026-08-15T12:00:00Z'));

        expect(result.skipped).toBe(true);
        expect(repo.createRun).not.toHaveBeenCalled();
    });

    it('flags failed and stale-pending payments', async () => {
        const staleDate = new Date();
        staleDate.setUTCDate(staleDate.getUTCDate() - 10);

        repo.getPaymentsForReconciliation.mockResolvedValue([
            makePayment({
                id: 'p-failed',
                payment_status: 'failed',
                transaction_reference: null,
            }),
            makePayment({
                id: 'p-stale',
                payment_status: 'pending',
                transaction_reference: null,
                created_at: staleDate,
            }),
            makePayment({ id: 'p-ok' }),
        ]);

        const result = await service.runReconciliation(new Date());

        expect(result.failed).toBe(1);
        expect(result.missing).toBe(1);
        expect(repo.addIssue).toHaveBeenCalledWith(
            'run-1',
            'failed',
            expect.objectContaining({ transactionReference: null }),
        );
        expect(repo.addIssue).toHaveBeenCalledWith(
            'run-1',
            'missing',
            expect.anything(),
        );
        expect(repo.completeRun).toHaveBeenCalledWith('run-1', {
            missing: 1,
            duplicate: 0,
            failed: 1,
            unmatched: 0,
            amountMismatch: 0,
        });
    });

    it('flags duplicate transaction references', async () => {
        repo.getPaymentsForReconciliation.mockResolvedValue([
            makePayment({ id: 'p-1' }),
            makePayment({ id: 'p-2', transaction_reference: 'QAL-CHAPA-123-R1-456-AAAA' }),
        ]);

        const result = await service.runReconciliation(new Date());

        expect(result.duplicate).toBe(1);
    });

    it('flags unmatched and amount-mismatched payments against a provider ledger', async () => {
        repo.getPaymentsForReconciliation.mockResolvedValue([
            makePayment({ id: 'p-unmatched', transaction_reference: 'REF-NOT-IN-LEDGER' }),
            makePayment({ id: 'p-mismatch', transaction_reference: 'REF-AMOUNT' }),
        ]);

        const result = await service.runReconciliation(
            new Date(),
            [
                { txRef: 'REF-AMOUNT', amount: 999 },
            ],
        );

        expect(result.unmatched).toBe(1);
        expect(result.amount_mismatch).toBe(1);
    });

    it('uses the sandbox ledger (no issues) when no ledger is provided', async () => {
        repo.getPaymentsForReconciliation.mockResolvedValue([
            makePayment({ id: 'p-ok' }),
        ]);

        const result = await service.runReconciliation(new Date());

        expect(result.unmatched).toBe(0);
        expect(result.amount_mismatch).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.missing).toBe(0);
    });
});