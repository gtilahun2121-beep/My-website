import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import Redlock from 'redlock';

import {
    PaymentsService,
    calculateFees,
} from './payments.service';
import { PaymentMethod } from './dto/checkout.dto';
import { PaymentsRepository } from './payments.repository';
import { RlsContext, getPool } from '../../config/database.config';

jest.mock('uuid', () => ({
    v4: () => '00000000-0000-4000-8000-000000000000',
}));

jest.mock('crypto', () => {
    const actual = jest.requireActual('crypto');
    return { ...actual, randomInt: jest.fn() };
});

jest.mock('../../config/database.config', () => ({
    inTransaction: jest.fn(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({ tx: true }),
    ),
    getPool: jest.fn(() => () => Promise.resolve({ rowCount: 1 })),
}));

const CONTEXT: RlsContext = { userId: 'user-1', userRole: 'participant' };

const FEE_CONFIG = {
    id: 'cfg-1',
    total_fee_rate: 0.15,
    host_commission_rate: 0.05,
    admin_fee_rate: 0.1,
};

const ACTIVE_EQUB = {
    id: 'equb-1',
    host_id: 'host-1',
    name: 'Test Equb',
    total_amount: 10000,
    contribution_amount: 1000,
    total_rounds: 10,
    current_round: 1,
    status: 'active',
    social_fund_balance: 0,
};

const APPROVED_MEMBERSHIP = {
    id: 'membership-1',
    user_id: 'user-1',
    equb_id: 'equb-1',
    status: 'approved',
    auto_debit_token: null,
    consent_granted_at: new Date(),
};

const PENDING_PAYMENT = {
    id: 'pay-1',
    user_id: 'user-1',
    equb_id: 'equb-1',
    round_number: 1,
    amount: 1000,
    fee_deducted: 100,
    host_commission_deducted: 50,
    payment_status: 'pending',
    transaction_reference: null,
    paid_at: null,
    created_at: new Date(),
};

function makeFakeRedlock(): Redlock {
    const unlock = jest.fn().mockResolvedValue(undefined);
    return {
        lock: jest.fn().mockResolvedValue({ unlock }),
    } as unknown as Redlock;
}

function makeRepoMock() {
    return {
        findEqubById: jest.fn(),
        getMembership: jest.fn(),
        getActiveFeeConfig: jest.fn(),
        findPendingPayment: jest.fn(),
        createPendingPayment: jest.fn(),
        lockPaymentForUpdate: jest.fn(),
        deductWalletBalance: jest.fn(),
        markPaymentPaid: jest.fn(),
        creditWalletBalance: jest.fn(),
        getAdminWalletUserId: jest.fn(),
        confirmPaymentByReference: jest.fn(),
        recordWebhookEvent: jest.fn(),
        markWebhookEventProcessed: jest.fn(),
        getPendingPaymentsForRound: jest.fn(),
        getEqubRoundInfo: jest.fn(),
        getLotteryDraw: jest.fn(),
        getEligibleMembersForDraw: jest.fn(),
        createLotteryDraw: jest.fn(),
        createPayout: jest.fn(),
        advanceEqubRound: jest.fn(),
        getLotteryDraws: jest.fn(),
        lockEqubCycleForUpdate: jest.fn(),
        getEligibleCandidatesForSpinRound: jest.fn(),
        getExistingDrawInTx: jest.fn(),
        markMembershipWonCycle: jest.fn(),
        insertLotteryEvent: jest.fn(),
        createLotteryDrawInTx: jest.fn(),
        createPayoutInTx: jest.fn(),
        advanceEqubRoundInTx: jest.fn(),
        createBid: jest.fn(),
        getRoundBids: jest.fn(),
        getWinningBid: jest.fn(),
        resolveAuction: jest.fn(),
    };
}

describe('calculateFees', () => {
    it('splits host commission and admin fee from the amount', () => {
        const result = calculateFees(1000, FEE_CONFIG);
        expect(result.hostCommissionDeducted).toBe(50);
        expect(result.feeDeducted).toBe(100);
        expect(result.netAmount).toBe(850);
    });

    it('rounds to two decimal places', () => {
        const result = calculateFees(999.99, FEE_CONFIG);
        expect(result.hostCommissionDeducted).toBe(50);
        expect(result.feeDeducted).toBe(100);
        expect(result.netAmount).toBe(849.99);
    });

    it('handles a zero amount without negative values', () => {
        const result = calculateFees(0, FEE_CONFIG);
        expect(result.hostCommissionDeducted).toBe(0);
        expect(result.feeDeducted).toBe(0);
        expect(result.netAmount).toBe(0);
    });
});

describe('PaymentsService.checkout', () => {
    let service: PaymentsService;
    let repo: ReturnType<typeof makeRepoMock>;
    let redlock: Redlock;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        redlock = makeFakeRedlock();
        service = new PaymentsService(repo as unknown as PaymentsRepository, redlock);
        repo.findEqubById.mockResolvedValue(ACTIVE_EQUB);
        repo.getMembership.mockResolvedValue(APPROVED_MEMBERSHIP);
        repo.getActiveFeeConfig.mockResolvedValue(FEE_CONFIG);
    });

    it('throws NotFoundException when the Equb does not exist', async () => {
        repo.findEqubById.mockResolvedValue(null);
        await expect(
            service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            ),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects payments when the Equb is not open/active', async () => {
        repo.findEqubById.mockResolvedValue({ ...ACTIVE_EQUB, status: 'completed' });
        await expect(
            service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects non-members', async () => {
        repo.getMembership.mockResolvedValue(null);
        await expect(
            service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            ),
        ).rejects.toThrow('not a member');
    });

    it('rejects members whose membership is not approved', async () => {
        repo.getMembership.mockResolvedValue({ ...APPROVED_MEMBERSHIP, status: 'pending' });
        await expect(
            service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            ),
        ).rejects.toThrow('not approved');
    });

    describe('wallet happy path (§3.3 double-payment prevention)', () => {
        beforeEach(() => {
            repo.findPendingPayment.mockResolvedValue(null);
            repo.createPendingPayment.mockResolvedValue({ id: 'pay-1' });
            repo.lockPaymentForUpdate.mockResolvedValue(PENDING_PAYMENT);
            repo.deductWalletBalance.mockResolvedValue(true);
            repo.getAdminWalletUserId.mockResolvedValue('admin-1');
        });

        it('commits the wallet deduction and credits host + admin fees', async () => {
            const result = await service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            );

            expect(result.status).toBe('paid');
            expect(result.payment_id).toBe('pay-1');
            expect(repo.markPaymentPaid).toHaveBeenCalledWith(
                'pay-1',
                expect.stringMatching(/^QAL-WLT-/),
                expect.anything(),
            );
            expect(repo.creditWalletBalance).toHaveBeenCalledWith(
                'host-1',
                50,
                expect.anything(),
            );
            expect(repo.creditWalletBalance).toHaveBeenCalledWith(
                'admin-1',
                100,
                expect.anything(),
            );
        });

        it('releases the Redlock after the transaction', async () => {
            await service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            );
            const lock = await (redlock.lock as jest.Mock).mock.results[0].value;
            expect(lock.unlock).toHaveBeenCalled();
        });

        it('returns an already-paid result without a second deduction', async () => {
            repo.lockPaymentForUpdate.mockResolvedValue({
                ...PENDING_PAYMENT,
                payment_status: 'paid',
            });
            const result = await service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            );
            expect(result.status).toBe('paid');
            expect(result.message).toContain('already been paid');
            expect(repo.deductWalletBalance).not.toHaveBeenCalled();
        });

        it('queues auto-debit when the wallet balance is insufficient', async () => {
            repo.deductWalletBalance.mockResolvedValue(false);
            const result = await service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                CONTEXT,
            );
            expect(result.status).toBe('pending');
            expect(result.message).toContain('Auto-debit');
            expect(repo.markPaymentPaid).not.toHaveBeenCalled();
        });

        it('throws ConflictException when the Redlock is already held', async () => {
            (redlock.lock as jest.Mock).mockRejectedValue(new Error('locked'));
            await expect(
                service.checkout(
                    { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.WALLET },
                    CONTEXT,
                ),
            ).rejects.toBeInstanceOf(ConflictException);
        });
    });

    describe('external payment init', () => {
        beforeEach(() => {
            repo.findPendingPayment.mockResolvedValue(null);
            repo.createPendingPayment.mockResolvedValue({ id: 'pay-2' });
        });

        it('builds a Chapa checkout URL with a CHAPA- tx ref', async () => {
            const result = await service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.CHAPA },
                CONTEXT,
            );
            expect(result.status).toBe('pending');
            expect(result.payment_id).toBe('pay-2');
            expect(result.checkout_url).toMatch(/^https:\/\/checkout\.chapa\.co\/checkout\/payment\/QAL-CHAPA-/);
            expect(getPool).toHaveBeenCalled();
        });

        it('builds a Telebirr checkout URL with a TELEBIRR- tx ref', async () => {
            const result = await service.checkout(
                { equb_id: 'equb-1', round_number: 1, payment_method: PaymentMethod.TELEBIRR },
                CONTEXT,
            );
            expect(result.checkout_url).toMatch(/^https:\/\/telebirr\.et\/checkout\/QAL-TELEBIRR-/);
        });
    });
});

describe('PaymentsService.submitBid', () => {
    let service: PaymentsService;
    let repo: ReturnType<typeof makeRepoMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new PaymentsService(repo as unknown as PaymentsRepository);
        repo.findEqubById.mockResolvedValue(ACTIVE_EQUB);
    });

    it('throws NotFoundException when the Equb does not exist', async () => {
        repo.findEqubById.mockResolvedValue(null);
        await expect(
            service.submitBid(
                { equb_id: 'equb-1', bid_amount: 1500 },
                CONTEXT,
            ),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('only allows bidding on active Equbs', async () => {
        repo.findEqubById.mockResolvedValue({ ...ACTIVE_EQUB, status: 'open' });
        await expect(
            service.submitBid(
                { equb_id: 'equb-1', bid_amount: 1500 },
                CONTEXT,
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects bids before the Equb is activated', async () => {
        repo.findEqubById.mockResolvedValue({ ...ACTIVE_EQUB, current_round: 0 });
        await expect(
            service.submitBid(
                { equb_id: 'equb-1', bid_amount: 1500 },
                CONTEXT,
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects bids at or above the pot value', async () => {
        await expect(
            service.submitBid(
                { equb_id: 'equb-1', bid_amount: 10000 },
                CONTEXT,
            ),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('records the bid into equb_bids and computes the potential payout', async () => {
        repo.createBid.mockResolvedValue({
            id: 'bid-1',
            bid_amount: 1500,
            potential_payout: 8500,
            status: 'open',
            inserted: true,
        });

        const result = await service.submitBid(
            { equb_id: 'equb-1', bid_amount: 1500 },
            CONTEXT,
        );

        expect(result.bid_recorded).toBe(true);
        expect(result.potential_payout).toBe(8500);
        expect(result.round_number).toBe(1);
        expect(result.updated).toBe(false);
        expect(result.message).toContain('1500');
        expect(repo.createBid).toHaveBeenCalledWith(
            'equb-1',
            'user-1',
            1,
            1500,
            8500,
            CONTEXT,
        );
    });

    it('reports a raised bid as an update', async () => {
        repo.createBid.mockResolvedValue({
            id: 'bid-1',
            bid_amount: 2500,
            potential_payout: 7500,
            status: 'open',
            inserted: false,
        });

        const result = await service.submitBid(
            { equb_id: 'equb-1', bid_amount: 2500 },
            CONTEXT,
        );

        expect(result.updated).toBe(true);
        expect(result.message).toContain('raised');
    });
});

describe('PaymentsService.resolveRoundAuction', () => {
    let service: PaymentsService;
    let repo: ReturnType<typeof makeRepoMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new PaymentsService(repo as unknown as PaymentsRepository);
        repo.getEqubRoundInfo.mockResolvedValue(ACTIVE_EQUB);
    });

    it('throws NotFoundException when the Equb does not exist', async () => {
        repo.getEqubRoundInfo.mockResolvedValue(null);
        await expect(service.resolveRoundAuction('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('rejects resolution on cancelled Equbs', async () => {
        repo.getEqubRoundInfo.mockResolvedValue({ ...ACTIVE_EQUB, status: 'cancelled' });
        await expect(service.resolveRoundAuction('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('rejects resolution when no bids were placed', async () => {
        repo.getRoundBids.mockResolvedValue([]);
        await expect(service.resolveRoundAuction('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            UnprocessableEntityException,
        );
    });

    it('awards the round to the highest bidder and advances the round', async () => {
        const bids = [
            {
                id: 'bid-1',
                equb_id: 'equb-1',
                user_id: 'alice',
                round_number: 1,
                bid_amount: 1500,
                potential_payout: 8500,
                status: 'open',
                created_at: new Date(),
                first_name: 'Alice',
                last_name: 'A',
                phone: '111',
            },
            {
                id: 'bid-2',
                equb_id: 'equb-1',
                user_id: 'bob',
                round_number: 1,
                bid_amount: 800,
                potential_payout: 9200,
                status: 'open',
                created_at: new Date(),
                first_name: 'Bob',
                last_name: 'B',
                phone: '222',
            },
        ];
        repo.getRoundBids.mockResolvedValue(bids);
        repo.resolveAuction.mockResolvedValue({ bidId: 'bid-1', inserted: true });

        const result = await service.resolveRoundAuction('equb-1', CONTEXT);

        expect(result.winner.id).toBe('alice');
        expect(result.bid_amount).toBe(1500);
        expect(result.payout_amount).toBe(8500);
        expect(result.redistributed_share).toBe(1500);
        expect(result.total_bids).toBe(2);
        expect(result.already_resolved).toBe(false);
        expect(repo.resolveAuction).toHaveBeenCalledWith(
            'equb-1',
            1,
            'alice',
            8500,
            CONTEXT,
        );
        expect(repo.advanceEqubRound).toHaveBeenCalledWith('equb-1', CONTEXT);
    });

    it('is idempotent — replays an existing winner without re-resolving', async () => {
        repo.getWinningBid.mockResolvedValue({
            id: 'bid-1',
            equb_id: 'equb-1',
            user_id: 'bob',
            round_number: 1,
            bid_amount: 800,
            potential_payout: 9200,
            status: 'winning',
            created_at: new Date(),
            first_name: 'Bob',
            last_name: 'B',
            phone: '222',
        });
        repo.getRoundBids.mockResolvedValue([]);

        const result = await service.resolveRoundAuction('equb-1', CONTEXT);

        expect(result.already_resolved).toBe(true);
        expect(result.winner.id).toBe('bob');
        expect(result.message).toContain('already resolved');
        expect(repo.resolveAuction).not.toHaveBeenCalled();
        expect(repo.advanceEqubRound).not.toHaveBeenCalled();
    });
});

describe('PaymentsService.runLotteryDraw', () => {
    let service: PaymentsService;
    let repo: ReturnType<typeof makeRepoMock>;

    const TX = { tx: true };

    // (id, membership_id) — candidates now carry their membership id so the
    // spin can write BOTH the winner state and the immutable ledger row.
    const candidates = [
        { id: 'alice', first_name: 'Alice', last_name: 'A', phone: '111', membership_id: 'mem-alice' },
        { id: 'bob', first_name: 'Bob', last_name: 'B', phone: '222', membership_id: 'mem-bob' },
    ];

    const eligibleOnly = (list: typeof candidates, excludeId?: string) =>
        list.filter((c) => c.membership_id !== excludeId);

    const createdDraw = {
        id: 'draw-1',
        equb_id: 'equb-1',
        round_number: 1,
        winner_id: 'alice',
        draw_timestamp: new Date(),
        video_url: null,
        svg_canvas_data: null,
        is_purged: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new PaymentsService(repo as unknown as PaymentsRepository);
        // runLotteryDraw opens a single inTransaction (mocked to run the
        // callback with TX) and locks the cycle row FOR UPDATE.
        repo.lockEqubCycleForUpdate.mockResolvedValue(ACTIVE_EQUB);
        repo.getExistingDrawInTx.mockResolvedValue(null);
        repo.getEligibleCandidatesForSpinRound.mockResolvedValue(candidates);
        repo.createLotteryDrawInTx.mockImplementation(
            async (_equbId, _round, winnerId, _video, _tx) => ({ ...createdDraw, winner_id: winnerId }),
        );
        repo.createPayoutInTx.mockResolvedValue(undefined);
        repo.markMembershipWonCycle.mockResolvedValue(undefined);
        repo.insertLotteryEvent.mockResolvedValue(undefined);
        repo.advanceEqubRoundInTx.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('runs inside a single transaction and locks the cycle FOR UPDATE', async () => {
        (crypto.randomInt as jest.Mock).mockReturnValue(0);
        await service.runLotteryDraw('equb-1', CONTEXT);
        expect(repo.lockEqubCycleForUpdate).toHaveBeenCalledWith('equb-1', TX);
    });

    it('throws NotFoundException when the Equb does not exist', async () => {
        repo.lockEqubCycleForUpdate.mockResolvedValue(null);
        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('rejects draws on cancelled Equbs', async () => {
        repo.lockEqubCycleForUpdate.mockResolvedValue({ ...ACTIVE_EQUB, status: 'cancelled' });
        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('rejects draws on completed Equbs', async () => {
        repo.lockEqubCycleForUpdate.mockResolvedValue({ ...ACTIVE_EQUB, status: 'completed' });
        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('rejects draws before the Equb is activated', async () => {
        repo.lockEqubCycleForUpdate.mockResolvedValue({ ...ACTIVE_EQUB, current_round: 0 });
        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('rejects draws when nobody is eligible (no paid / all already won)', async () => {
        repo.getEligibleCandidatesForSpinRound.mockResolvedValue([]);
        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toBeInstanceOf(
            UnprocessableEntityException,
        );
    });

    it('selects exactly one winner from the eligible pool via CSPRNG', async () => {
        (crypto.randomInt as jest.Mock).mockReturnValue(1);

        const result = await service.runLotteryDraw('equb-1', CONTEXT);

        expect(crypto.randomInt).toHaveBeenCalledWith(0, 2);
        expect(result.winner.id).toBe('bob');
        expect(result.candidates).toHaveLength(2);
        expect(result.draw.winner_id).toBe('bob');
    });

    it('writer updates winner state, inserts immutable event, payout, round advance in ONE transaction', async () => {
        (crypto.randomInt as jest.Mock).mockReturnValue(0);
        repo.createLotteryDrawInTx.mockResolvedValue(createdDraw);

        const result = await service.runLotteryDraw('equb-1', CONTEXT);

        expect(repo.markMembershipWonCycle).toHaveBeenCalledWith('mem-alice', 1, TX);
        expect(repo.insertLotteryEvent).toHaveBeenCalledWith(
            'equb-1', 1, 'mem-alice', 'alice', 'LOTTERY_WIN', CONTEXT.userId,
            { candidate_count: 2 }, TX,
        );
        expect(repo.createLotteryDrawInTx).toHaveBeenCalledWith('equb-1', 1, 'alice', null, TX);
        expect(repo.createPayoutInTx).toHaveBeenCalledWith('equb-1', 1, 'alice', 2000, TX);
        expect(repo.insertLotteryEvent).toHaveBeenCalledWith(
            'equb-1', 1, 'mem-alice', 'alice', 'PAYOUT_SCHEDULED', CONTEXT.userId,
            expect.anything(), TX,
        );
        expect(repo.advanceEqubRoundInTx).toHaveBeenCalledWith('equb-1', TX);
        expect(result.winner.id).toBe('alice');
    });

    it('uses crypto.randomInt (CSPRNG), never Math.random', () => {
        const src = paymentsServiceSource();
        expect(src).toContain('crypto.randomInt');
        expect(src).not.toContain('Math.random(');
    });

    it('is idempotent — replays the existing draw without drawing twice or writing again', async () => {
        const existing = { ...createdDraw, winner_id: 'bob' };
        repo.getExistingDrawInTx.mockResolvedValue(existing);

        const result = await service.runLotteryDraw('equb-1', CONTEXT);

        expect(result.draw.id).toBe('draw-1');
        expect(result.draw.winner_id).toBe('bob');
        expect(result.winner.id).toBe('bob');
        expect(result.message).toContain('already drawn');
        expect(repo.markMembershipWonCycle).not.toHaveBeenCalled();
        expect(repo.insertLotteryEvent).not.toHaveBeenCalled();
        expect(repo.createLotteryDrawInTx).not.toHaveBeenCalled();
        expect(repo.createPayoutInTx).not.toHaveBeenCalled();
        expect(repo.advanceEqubRoundInTx).not.toHaveBeenCalled();
    });

    it('excludes a previous cycle winner from the candidate pool', async () => {
        repo.getEligibleCandidatesForSpinRound.mockImplementation(
            async () => eligibleOnly(candidates, 'mem-alice'),
        );
        (crypto.randomInt as jest.Mock).mockReturnValue(0);

        const result = await service.runLotteryDraw('equb-1', CONTEXT);

        // The repo (database) did the exclusion: alice is gone from the pool.
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].id).toBe('bob');
        expect(result.winner.id).toBe('bob');
    });

    it('rolls back the winner update if the ledger event insert fails', async () => {
        (crypto.randomInt as jest.Mock).mockReturnValue(0);
        // The service throws AFTER the winner-state write, but because every
        // write shares one transaction, the DB rollback reverts the winner
        // update. Here we assert the error propagates and the draw is not
        // considered persisted (no advance).
        repo.insertLotteryEvent.mockImplementation(async () => {
            throw new Error('duplicate key value violates unique constraint');
        });

        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toThrow(
            'duplicate key value violates unique constraint',
        );
        expect(repo.advanceEqubRoundInTx).not.toHaveBeenCalled();
        expect(repo.createPayoutInTx).not.toHaveBeenCalled();
    });

    it('propagates a winner-state update failure (full rollback)', async () => {
        (crypto.randomInt as jest.Mock).mockReturnValue(0);
        repo.markMembershipWonCycle.mockImplementation(async () => {
            throw new Error('winner update failed');
        });

        await expect(service.runLotteryDraw('equb-1', CONTEXT)).rejects.toThrow(
            'winner update failed',
        );
        expect(repo.insertLotteryEvent).not.toHaveBeenCalled();
        expect(repo.createLotteryDrawInTx).not.toHaveBeenCalled();
        expect(repo.advanceEqubRoundInTx).not.toHaveBeenCalled();
    });
});

/** Reads the payments.service.ts source to assert CSPRNG usage. */
function paymentsServiceSource(): string {
    return readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
}