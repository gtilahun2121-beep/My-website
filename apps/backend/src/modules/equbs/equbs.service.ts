import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
    EqubsRepository,
    CreateEqubInput,
    CreateRequestInput,
} from './equbs.repository';
import { RlsContext } from '../../config/database.config';

@Injectable()
export class EqubsService {
    constructor(private readonly repo: EqubsRepository) {}

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
        return this.repo.createCreationRequest(input, userId);
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
        return result;
    }

    async rejectRequest(adminId: string, requestId: string, notes?: string) {
        const result = await this.repo.rejectCreationRequest(requestId, adminId, notes);
        if (!result.success) {
            if (result.error === 'REQUEST_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
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
        return result;
    }

    async rejectMembership(adminId: string, membershipId: string) {
        const result = await this.repo.rejectMembership(membershipId, adminId);
        if (!result.success) {
            if (result.error === 'MEMBERSHIP_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }
        return result;
    }
}
