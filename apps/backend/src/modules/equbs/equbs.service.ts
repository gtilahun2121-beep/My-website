import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
    EqubsRepository,
    CreateEqubInput,
    CreateRequestInput,
} from './equbs.repository';
import { RlsContext } from '../../config/database.config';
import { NotificationsRepository } from '../notifications/notifications.repository';

@Injectable()
export class EqubsService {
    private readonly logger = new Logger(EqubsService.name);

    constructor(
        private readonly repo: EqubsRepository,
        private readonly notifications: NotificationsRepository,
    ) {}

    async findAll() {
        return this.repo.findAll();
    }

    async findById(id: string, userId?: string) {
        const equb = await this.repo.findById(id, userId);
        if (!equb) throw new NotFoundException('Equb not found');
        return equb;
    }

    async findMine(userId: string) {
        return this.repo.findMine(userId);
    }

    validateCreatePayload(data: any): CreateEqubInput {
        if (!data || typeof data !== 'object') {
            throw new BadRequestException('Invalid payload');
        }

        const name = typeof data.name === 'string' ? data.name.trim() : '';
        if (name.length === 0) {
            throw new BadRequestException('Equb name is required');
        }

        const contribution = Number(data.contribution_amount ?? data.contributionSize);
        const totalRounds = Number(data.total_rounds ?? data.totalRounds);
        const cycleDays = Number(data.cycle_days ?? data.cycleDays);

        if (!Number.isFinite(contribution) || contribution <= 0) {
            throw new BadRequestException('contribution_amount must be a positive number');
        }
        if (!Number.isFinite(totalRounds) || totalRounds <= 0) {
            throw new BadRequestException('total_rounds must be a positive integer');
        }
        if (!Number.isFinite(cycleDays) || cycleDays < 3) {
            throw new BadRequestException('cycle_days must be at least 3');
        }

        return {
            name,
            description: typeof data.description === 'string' ? data.description : undefined,
            total_amount: contribution * totalRounds,
            contribution_amount: contribution,
            cycle_days: cycleDays,
            total_rounds: Math.floor(totalRounds),
        };
    }

    /**
     * Direct creation — admin only. The admin acts as the Equb host.
     * Role enforcement lives in the controller (RolesGuard).
     */
    async create(adminId: string, input: CreateEqubInput) {
        const ctx: RlsContext = { userId: adminId, userRole: 'admin' };
        return this.repo.create(input, adminId, ctx);
    }

    /**
     * Member requests to join an existing Equb.
     * Non-admin members enter a 'pending' membership until an admin approves.
     */
    async join(equbId: string, userId: string, role: string) {
        const ctx: RlsContext = { userId, userRole: role === 'admin' ? 'admin' : 'participant' };
        const result = await this.repo.join(equbId, userId, ctx, role === 'admin');

        if (result && result.error) {
            if (result.error === 'EQUB_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }

        // A pending join request needs admin review — notify every admin.
        if (result?.pending) {
            await this.dispatchJoinRequest(equbId, userId, result.equbName);
        }
        return result;
    }

    // ── Equb creation requests (member asks the admin) ─────────────────────────

    validateRequestPayload(data: any): CreateRequestInput {
        if (!data || typeof data !== 'object') {
            throw new BadRequestException('Invalid payload');
        }

        const name = typeof data.name === 'string' ? data.name.trim() : '';
        if (name.length === 0) {
            throw new BadRequestException('Equb name is required');
        }

        const contribution = Number(data.contribution_amount ?? data.contributionSize);
        const totalRounds = Number(data.total_rounds ?? data.totalRounds);
        const cycleDays = Number(data.cycle_days ?? data.cycleDays);

        if (!Number.isFinite(contribution) || contribution <= 0) {
            throw new BadRequestException('contribution_amount must be a positive number');
        }
        if (!Number.isFinite(totalRounds) || totalRounds <= 0) {
            throw new BadRequestException('total_rounds must be a positive integer');
        }
        if (!Number.isFinite(cycleDays) || cycleDays < 3) {
            throw new BadRequestException('cycle_days must be at least 3');
        }

        return {
            name,
            description: typeof data.description === 'string' ? data.description : undefined,
            contribution_amount: contribution,
            cycle_days: cycleDays,
            total_rounds: Math.floor(totalRounds),
        };
    }

    async requestCreate(userId: string, data: any) {
        const input = this.validateRequestPayload(data);
        const request = await this.repo.createCreationRequest(input, userId);

        // A member asked the admin to create an Equb — notify every admin.
        const user = await this.repo.getUserName(userId);
        const name = user ? `${user.first_name} ${user.last_name}`.trim() : 'A member';
        await this.notifyAdmins(
            'New equb creation request',
            `${name} requested to create an equb named "${input.name}".`,
        );
        return request;
    }

    async getMyRequests(userId: string) {
        return this.repo.listMyCreationRequests(userId);
    }

    // ── Admin: review creation requests ────────────────────────────────────────

    async listPendingRequests(adminId: string) {
        return this.repo.listPendingCreationRequests(adminId);
    }

    async approveRequest(adminId: string, requestId: string) {
        const result = await this.repo.approveCreationRequest(requestId, adminId);
        if (!result.success) {
            if (result.error === 'REQUEST_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }
        if (result.requesterId) {
            await this.notifyUser(
                result.requesterId,
                'Equb approved',
                `Your request to create "${result.equb.name}" has been approved and the Equb is ready.`,
            );
        }
        return result;
    }

    async rejectRequest(adminId: string, requestId: string, notes?: string) {
        const result = await this.repo.rejectCreationRequest(requestId, adminId, notes);
        if (!result.success) {
            if (result.error === 'REQUEST_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }
        const requesterId = result.request?.requester_id;
        if (requesterId) {
            const detail = notes ? ` Reason: ${notes}` : '';
            await this.notifyUser(
                requesterId,
                'Request rejected',
                `Your request to create "${result.request?.name ?? 'an equb'}" was rejected.${detail}`,
            );
        }
        return result;
    }

    // ── Admin: review join requests ────────────────────────────────────────────

    async listPendingMemberships(adminId: string) {
        return this.repo.listPendingJoinRequests(adminId);
    }

    async approveMembership(adminId: string, membershipId: string) {
        const result = await this.repo.approveMembership(membershipId, adminId);
        if (!result.success) {
            if (result.error === 'MEMBERSHIP_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }
        const m = result.membership;
        if (m?.user_id) {
            await this.notifyUser(
                m.user_id,
                'Join request approved',
                `You have been approved to join "${m.equb_name ?? 'the Equb'}".`,
            );
        }
        return result;
    }

    async rejectMembership(adminId: string, membershipId: string) {
        const result = await this.repo.rejectMembership(membershipId, adminId);
        if (!result.success) {
            if (result.error === 'MEMBERSHIP_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }
        const m = result.membership;
        if (m?.user_id) {
            await this.notifyUser(
                m.user_id,
                'Join request rejected',
                `Your request to join "${m.equb_name ?? 'the Equb'}" was rejected.`,
            );
        }
        return result;
    }

    // ── Notification helpers ───────────────────────────────────────────────────

    /**
     * Best-effort notification dispatch — a failure to notify must never
     * break the underlying operation, so every dispatch is swallowed.
     */
    private async notifyAdmins(title: string, body: string): Promise<void> {
        try {
            await this.notifications.dispatchToAdmins('operational', title, body);
        } catch (err) {
            this.logger.warn(`Failed to notify admins: ${err instanceof Error ? err.message : 'unknown'}`);
        }
    }

    private async notifyUser(userId: string, title: string, body: string): Promise<void> {
        try {
            await this.notifications.dispatch({ user_id: userId, category: 'operational', title, body });
        } catch (err) {
            this.logger.warn(`Failed to notify user ${userId}: ${err instanceof Error ? err.message : 'unknown'}`);
        }
    }

    private async dispatchJoinRequest(equbId: string, userId: string, equbName?: string | null): Promise<void> {
        try {
            const user = await this.repo.getUserName(userId);
            const name = user ? `${user.first_name} ${user.last_name}`.trim() : 'A member';
            const name2 = equbName ?? (await this.repo.getEqubName(equbId)) ?? 'an Equb';
            await this.notifications.dispatchToAdmins(
                'operational',
                'New join request',
                `${name} wants to join "${name2}".`,
            );
        } catch (err) {
            this.logger.warn(`Failed to notify join request: ${err instanceof Error ? err.message : 'unknown'}`);
        }
    }
}
