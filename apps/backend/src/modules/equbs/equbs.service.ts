import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EqubsRepository, CreateEqubInput } from './equbs.repository';
import { getPool, RlsContext } from '../../config/database.config';

@Injectable()
export class EqubsService {
    constructor(private readonly repo: EqubsRepository) {}

    async findAll() {
        return this.repo.findAll();
    }

    async findById(id: string) {
        const equb = await this.repo.findById(id);
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

    async create(hostId: string, input: CreateEqubInput) {
        const ctx: RlsContext = { userId: hostId, userRole: 'host' };
        return this.repo.create(input, hostId, ctx);
    }

    async join(equbId: string, userId: string) {
        // Resolve the caller's role so RLS sees the correct context.
        const sql = getPool();
        const rows = await sql`SELECT role FROM users WHERE id = ${userId}`;
        const role = rows[0]?.role ?? 'participant';

        const ctx: RlsContext = { userId, userRole: role };
        const result = await this.repo.join(equbId, userId, ctx);

        if (result && result.error) {
            if (result.error === 'EQUB_NOT_FOUND') throw new NotFoundException(result.message);
            throw new BadRequestException(result.message);
        }
        return result;
    }
}
