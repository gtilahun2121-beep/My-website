import { BadRequestException, NotFoundException } from '@nestjs/common';

import { EqubsService } from './equbs.service';
import { EqubsRepository } from './equbs.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';

function makeRepoMock() {
    return {
        findAll: jest.fn(),
        findById: jest.fn(),
        findMine: jest.fn(),
        create: jest.fn(),
        join: jest.fn(),
        activateEqub: jest.fn(),
        getUserName: jest.fn(),
        getEqubName: jest.fn(),
        createCreationRequest: jest.fn(),
        listMyCreationRequests: jest.fn(),
        listPendingCreationRequests: jest.fn(),
        approveCreationRequest: jest.fn(),
        rejectCreationRequest: jest.fn(),
        listPendingJoinRequests: jest.fn(),
        approveMembership: jest.fn(),
        rejectMembership: jest.fn(),
    };
}

function makeNotificationsMock() {
    return {
        dispatch: jest.fn(),
        dispatchToAdmins: jest.fn(),
    };
}

describe('EqubsService payload validation', () => {
    let service: EqubsService;

    beforeEach(() => {
        service = new EqubsService(makeRepoMock() as unknown as EqubsRepository, makeNotificationsMock() as unknown as NotificationsRepository);
    });

    it('normalizes a valid create payload', () => {
        const input = service.validateCreatePayload({
            name: '  My Equb  ',
            contribution_amount: 1000,
            total_rounds: 10,
            cycle_days: 30,
        });
        expect(input).toEqual({
            name: 'My Equb',
            description: undefined,
            total_amount: 10000,
            contribution_amount: 1000,
            cycle_days: 30,
            total_rounds: 10,
            winner_selection_type: 'lottery',
            equb_type: 'public',
            preset_template_id: undefined,
        });
    });

    it('rejects a missing equb name', () => {
        expect(() =>
            service.validateCreatePayload({ contribution_amount: 1000, total_rounds: 10, cycle_days: 30 }),
        ).toThrow(BadRequestException);
    });

    it('rejects non-positive contribution amounts', () => {
        expect(() =>
            service.validateCreatePayload({ name: 'X', contribution_amount: 0, total_rounds: 10, cycle_days: 30 }),
        ).toThrow(BadRequestException);
    });

    it('rejects cycle_days below 3', () => {
        expect(() =>
            service.validateCreatePayload({ name: 'X', contribution_amount: 100, total_rounds: 10, cycle_days: 2 }),
        ).toThrow(BadRequestException);
    });

    it('rounds total_rounds down to an integer', () => {
        const input = service.validateCreatePayload({
            name: 'X',
            contribution_amount: 100,
            total_rounds: 3.7,
            cycle_days: 7,
        });
        expect(input.total_rounds).toBe(3);
    });

    it('rejects an invalid request payload', () => {
        expect(() => service.validateRequestPayload(null)).toThrow(BadRequestException);
    });
});

describe('EqubsService.activate', () => {
    let service: EqubsService;
    let repo: ReturnType<typeof makeRepoMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new EqubsService(repo as unknown as EqubsRepository, makeNotificationsMock() as unknown as NotificationsRepository);
    });

    it('throws NotFoundException when the Equb does not exist', async () => {
        repo.activateEqub.mockResolvedValue({
            success: false,
            error: 'EQUB_NOT_FOUND',
            message: 'Equb not found.',
        });
        await expect(service.activate('equb-1', 'user-1', 'host')).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('throws BadRequestException on invalid activation state', async () => {
        repo.activateEqub.mockResolvedValue({
            success: false,
            error: 'EQUB_ALREADY_STARTED',
            message: 'Equb has already started.',
        });
        await expect(service.activate('equb-1', 'user-1', 'host')).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('returns the activation result on success', async () => {
        repo.activateEqub.mockResolvedValue({ success: true, message: 'Equb activated.' });
        const result = await service.activate('equb-1', 'user-1', 'host');
        expect(result).toEqual({ success: true, message: 'Equb activated.' });
        expect(repo.activateEqub).toHaveBeenCalledWith('equb-1', {
            userId: 'user-1',
            userRole: 'host',
        });
    });

    it('uses the admin role context for admin activation', async () => {
        repo.activateEqub.mockResolvedValue({ success: true });
        await service.activate('equb-1', 'user-1', 'admin');
        expect(repo.activateEqub).toHaveBeenCalledWith('equb-1', {
            userId: 'user-1',
            userRole: 'admin',
        });
    });
});

describe('EqubsService.findById', () => {
    it('throws NotFoundException when the Equb is missing', async () => {
        const repo = makeRepoMock();
        repo.findById.mockResolvedValue(null);
        const service = new EqubsService(repo as unknown as EqubsRepository, makeNotificationsMock() as unknown as NotificationsRepository);
        await expect(service.findById('equb-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the Equb when found', async () => {
        const repo = makeRepoMock();
        repo.findById.mockResolvedValue({ id: 'equb-1', name: 'X' });
        const service = new EqubsService(repo as unknown as EqubsRepository, makeNotificationsMock() as unknown as NotificationsRepository);
        await expect(service.findById('equb-1')).resolves.toEqual({ id: 'equb-1', name: 'X' });
    });
});

describe('EqubsService.join', () => {
    let service: EqubsService;
    let repo: ReturnType<typeof makeRepoMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        service = new EqubsService(repo as unknown as EqubsRepository, makeNotificationsMock() as unknown as NotificationsRepository);
    });

    it('throws NotFoundException when the Equb does not exist', async () => {
        repo.join.mockResolvedValue({ error: 'EQUB_NOT_FOUND', message: 'not found' });
        await expect(service.join('equb-1', 'user-1', 'participant')).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('treats an already-pending request as an idempotent success', async () => {
        repo.join.mockResolvedValue({ error: 'ALREADY_PENDING', message: 'pending' });
        const result = await service.join('equb-1', 'user-1', 'participant');
        expect(result).toMatchObject({ success: true, pending: true, alreadyRequested: true });
    });

    it('treats an existing membership as an idempotent success', async () => {
        repo.join.mockResolvedValue({ error: 'ALREADY_MEMBER', message: 'member' });
        const result = await service.join('equb-1', 'user-1', 'participant');
        expect(result).toMatchObject({ success: true, alreadyMember: true });
    });

    it('dispatches an admin notification for a new pending request', async () => {
        const notifications = makeNotificationsMock();
        service = new EqubsService(repo as unknown as EqubsRepository, notifications as unknown as NotificationsRepository);
        repo.join.mockResolvedValue({ pending: true, equbName: 'My Equb', id: 'm1' });
        repo.getUserName.mockResolvedValue({ first_name: 'A', last_name: 'B' });

        await service.join('equb-1', 'user-1', 'participant');

        expect(notifications.dispatchToAdmins).toHaveBeenCalledWith(
            'operational',
            'New join request',
            expect.stringContaining('My Equb'),
        );
    });
});

describe('EqubsService admin membership review', () => {
    let service: EqubsService;
    let repo: ReturnType<typeof makeRepoMock>;
    let notifications: ReturnType<typeof makeNotificationsMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        repo = makeRepoMock();
        notifications = makeNotificationsMock();
        service = new EqubsService(repo as unknown as EqubsRepository, notifications as unknown as NotificationsRepository);
    });

    it('throws NotFoundException when the membership is missing', async () => {
        repo.approveMembership.mockResolvedValue({
            success: false,
            error: 'MEMBERSHIP_NOT_FOUND',
            message: 'not found',
        });
        await expect(service.approveMembership('admin-1', 'm1')).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('notifies the member on approval', async () => {
        repo.approveMembership.mockResolvedValue({
            success: true,
            membership: { user_id: 'user-1', equb_name: 'My Equb' },
        });
        const result = await service.approveMembership('admin-1', 'm1');
        expect(result).toEqual({ success: true, membership: { user_id: 'user-1', equb_name: 'My Equb' } });
        expect(notifications.dispatch).toHaveBeenCalledWith({
            user_id: 'user-1',
            category: 'operational',
            title: 'Join request approved',
            body: expect.stringContaining('My Equb'),
        });
    });
});