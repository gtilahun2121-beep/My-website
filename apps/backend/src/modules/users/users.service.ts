import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersRepository, ListCustomersOptions } from './users.repository';
import { VaultConfig } from '../../config/vault.config';

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
    saltLength: 16,
};

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

    /**
     * Admin resets a user's PIN (padded identically to registration) and
     * clears any login lockout so a permanently blocked account is unblocked.
     */
    async resetUserPin(adminId: string, userId: string, newPin: string) {
        const secrets = await VaultConfig.load();
        const passwordHash = await argon2.hash(
            newPin + secrets.ARGON2_PEPPER,
            ARGON2_OPTIONS,
        );

        const user = await this.repo.resetPinAndUnlock(adminId, userId, passwordHash);
        if (!user) {
            throw new NotFoundException('User not found.');
        }
        return { success: true, user };
    }

    /**
     * Admin grants or revokes a user's role (participant / host / admin).
     * The database owner uses this to promote a registered member to
     * website admin — which gives them the admin dashboard and console.
     * An admin can never change their own role, so the system keeps
     * at least one administrator.
     */
    async setUserRole(adminId: string, userId: string, role: 'participant' | 'host' | 'admin') {
        if (adminId === userId) {
            throw new BadRequestException('You cannot change your own role.');
        }

        const user = await this.repo.setUserRole(adminId, userId, role);
        if (!user) {
            throw new NotFoundException('User not found.');
        }
        return { success: true, user };
    }
}
