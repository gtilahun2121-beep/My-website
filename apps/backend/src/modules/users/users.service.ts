import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository, ListCustomersOptions } from './users.repository';

@Injectable()
export class UsersService {
    constructor(private readonly repo: UsersRepository) {}

    async listCustomers(opts: ListCustomersOptions) {
        return this.repo.listCustomers(opts);
    }

    async getProfile(userId: string) {
        const user = await this.repo.findById(userId);
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async updateProfile(userId: string, data: any) {
        return this.repo.update(userId, data);
    }
}
