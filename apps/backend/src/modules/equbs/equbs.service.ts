import { Injectable, NotFoundException } from '@nestjs/common';
import { EqubsRepository } from './equbs.repository';

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

    async create(hostId: string, data: any) {
        return this.repo.create(hostId, data);
    }

    async join(equbId: string, userId: string) {
        return this.repo.join(equbId, userId);
    }
}
