/**
 * Lottery Selection Service
 * Handles random winner selection for equb payout cycles using cryptographic PRNG
 */

import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';

import {
    MemberEligibility,
    PayoutCycleInfo,
    WinnerSelectionResult,
    WinnerSelectionRecord,
    PayoutHistoryRecord,
    DrawValidationResult,
    AuditLogEntry,
    PRNGConfig,
} from '../interfaces/lottery.interface';

/**
 * Repository injection interface
 */
interface RepositoryCollection {
    payoutCycleRepository: any;
    memberEligibilityRepository: any;
    winnerSelectionRepository: any;
    payoutHistoryRepository: any;
    auditLogRepository: any;
    paymentReminderRepository: any;
}

@Injectable()
export class LotterySelectionService {
    private readonly logger = new Logger(LotterySelectionService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly repositories: RepositoryCollection,
    ) {}

    /**
     * Main method: Select a winner for a payout cycle using lottery mechanism
     *
     * Process:
     * 1. Verify cycle exists and is in drawable state
     * 2. Get eligible members
     * 3. Ensure at least 1 eligible member exists
     * 4. Generate cryptographic random selection
     * 5. Execute atomic transaction to record selection
     * 6. Notify winner
     *
     * @param equbId - The equb identifier
     * @param cycleId - The payout cycle identifier
     * @returns Winner selection result
     * @throws NotFoundException if cycle or equb not found
     * @throws BadRequestException if cycle not in drawable state or no eligible members
     */
    async selectWinnerForCycle(equbId: string, cycleId: string): Promise<WinnerSelectionResult> {
        this.logger.log(
            `Starting lottery selection for equb: ${equbId}, cycle: ${cycleId}`,
        );

        // Step 1: Validate cycle exists and is drawable
        const cycle = await this.validateDrawConditions(cycleId);
        if (!cycle.valid) {
            this.logger.warn(
                `Draw validation failed for cycle ${cycleId}. Errors: ${cycle.errors.join(', ')}`,
            );
            throw new BadRequestException(
                `Cannot draw winner: ${cycle.errors.join(', ')}`,
            );
        }

        // Step 2: Get eligible members
        const eligibleMembers = await this.getEligibleMembers(cycleId);
        const memberCount = eligibleMembers.length;

        // Log eligibility check
        await this.createAuditLog({
            action: 'ELIGIBILITY_CHECK',
            cycleId,
            equbId,
            performedBy: 'SYSTEM',
            memberCount,
            details: {
                eligibleMembers: eligibleMembers.map(m => ({
                    id: m.member_id,
                    name: m.member_name,
                })),
            },
            timestamp: new Date(),
        });

        // Step 3: Verify at least 1 eligible member
        if (memberCount === 0) {
            const error = 'No eligible members found for lottery draw';
            this.logger.error(error);
            throw new BadRequestException(error);
        }

        // Step 4: Generate PRNG seed and select winner
        const prngConfig = this.generatePRNGSeed();
        const selectedIndex = this.selectRandomIndex(eligibleMembers.length, prngConfig);
        const winner = eligibleMembers[selectedIndex];

        this.logger.log(
            `Winner selected: ${winner.member_id} (${winner.member_name}) from ${memberCount} eligible members`,
        );

        // Step 5: Execute atomic transaction
        const result = await this.executeWinnerSelectionTransaction(
            equbId,
            cycleId,
            winner,
            memberCount,
            prngConfig,
        );

        // Step 6: Log selection
        await this.createAuditLog({
            action: 'WINNER_SELECTED',
            cycleId,
            equbId,
            performedBy: 'SYSTEM',
            winnerId: winner.member_id,
            memberCount,
            details: {
                winnerName: winner.member_name,
                prngSeed: prngConfig.seed,
                selectedIndex,
            },
            timestamp: new Date(),
        });

        this.logger.log(
            `Lottery selection completed successfully for cycle ${cycleId}`,
        );

        return result;
    }

    /**
     * Get list of eligible members for a cycle
     *
     * Filters out members who:
     * - Have NOT paid their contribution (has_paid_contribution = FALSE)
     * - Are past winners in this cycle (is_past_winner = TRUE)
     * - Have opted out of this cycle (has_opted_out = TRUE)
     * - Are not active members (is_active_member = FALSE)
     *
     * @param cycleId - The payout cycle identifier
     * @returns Array of eligible members
     */
    async getEligibleMembers(cycleId: string): Promise<MemberEligibility[]> {
        try {
            const members = await this.repositories.memberEligibilityRepository.find({
                where: {
                    payout_cycle_id: cycleId,
                    has_paid_contribution: true,
                    is_past_winner: false,
                    has_opted_out: false,
                    is_active_member: true,
                },
            });

            this.logger.log(
                `Retrieved ${members.length} eligible members for cycle ${cycleId}`,
            );

            return members;
        } catch (error) {
            this.logger.error(
                `Failed to get eligible members for cycle ${cycleId}: ${error}`,
            );
            throw new InternalServerErrorException(
                'Failed to retrieve eligible members',
            );
        }
    }

    /**
     * Verify if a member is a past winner in the current cycle
     *
     * @param cycleId - The payout cycle identifier
     * @param memberId - The member identifier
     * @returns True if member is a past winner, false otherwise
     */
    async verifyPastWinner(cycleId: string, memberId: string): Promise<boolean> {
        try {
            const eligibility = await this.repositories.memberEligibilityRepository.findOne({
                where: {
                    payout_cycle_id: cycleId,
                    member_id: memberId,
                },
            });

            return eligibility?.is_past_winner ?? false;
        } catch (error) {
            this.logger.error(
                `Failed to verify past winner status for member ${memberId}: ${error}`,
            );
            throw new InternalServerErrorException(
                'Failed to verify past winner status',
            );
        }
    }

    /**
     * Pre-draw validation checks
     *
     * Validates:
     * - Cycle exists
     * - Cycle status is 'OPEN' or 'DRAWING'
     * - Cycle does not already have a winner
     * - At least 1 eligible member exists
     *
     * @param cycleId - The payout cycle identifier
     * @returns Validation result with errors/warnings
     */
    async validateDrawConditions(cycleId: string): Promise<DrawValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Check cycle exists
            const cycle = await this.repositories.payoutCycleRepository.findOne({
                where: { cycle_id: cycleId },
            });

            if (!cycle) {
                errors.push(`Payout cycle ${cycleId} not found`);
                return { valid: false, errors };
            }

            // Check cycle status
            if (!['OPEN', 'DRAWING'].includes(cycle.status)) {
                errors.push(
                    `Cycle is in '${cycle.status}' state. Only 'OPEN' or 'DRAWING' cycles can be drawn.`,
                );
            }

            // Check cycle already has winner
            if (cycle.selected_winner_id) {
                errors.push(
                    `Cycle already has a selected winner: ${cycle.selected_winner_id}`,
                );
            }

            // Get eligible members count
            const eligibleMembers = await this.getEligibleMembers(cycleId);
            const eligibleCount = eligibleMembers.length;

            if (eligibleCount === 0) {
                errors.push(
                    'No eligible members found for this cycle',
                );
            } else if (eligibleCount === 1) {
                warnings.push(
                    `Only 1 eligible member exists. This member will be automatically selected.`,
                );
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings: warnings.length > 0 ? warnings : undefined,
                eligibleMemberCount: eligibleCount,
            };
        } catch (error) {
            this.logger.error(`Failed to validate draw conditions: ${error}`);
            throw new InternalServerErrorException(
                'Failed to validate draw conditions',
            );
        }
    }

    /**
     * Check if a selection can be reversed/undone
     *
     * Selection can be undone if:
     * - Selection exists
     * - Cycle is still in 'DRAWING' state (not yet completed)
     * - No payments have been processed for the winner
     *
     * @param selectionId - The winner selection identifier
     * @returns True if selection can be reversed, false otherwise
     */
    async canUndoSelection(selectionId: string): Promise<boolean> {
        try {
            const selection = await this.repositories.winnerSelectionRepository.findOne({
                where: { selection_id: selectionId },
            });

            if (!selection) {
                this.logger.warn(`Selection ${selectionId} not found`);
                return false;
            }

            // Check cycle status
            const cycle = await this.repositories.payoutCycleRepository.findOne({
                where: { cycle_id: selection.payout_cycle_id },
            });

            if (!cycle || cycle.status !== 'DRAWING') {
                this.logger.warn(
                    `Cannot undo selection - cycle status is '${cycle?.status}'`,
                );
                return false;
            }

            // Check if payments have been processed
            const paymentHistory = await this.repositories.payoutHistoryRepository.find({
                where: {
                    payout_cycle_id: selection.payout_cycle_id,
                },
            });

            const hasProcessedPayments = paymentHistory.some(p =>
                ['PROCESSING', 'COMPLETED'].includes(p.status),
            );

            if (hasProcessedPayments) {
                this.logger.warn(
                    `Cannot undo selection - payments have been processed`,
                );
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error(`Failed to check if selection can be undone: ${error}`);
            return false;
        }
    }

    /**
     * Generate cryptographic PRNG seed for reproducibility
     *
     * Uses crypto.randomBytes for cryptographic randomness
     * Includes timestamp for additional entropy
     *
     * @returns PRNG configuration with seed and metadata
     */
    private generatePRNGSeed(): PRNGConfig {
        try {
            // Generate 32 bytes of cryptographic random data
            const randomBytes32 = randomBytes(32);
            const timestamp = new Date();
            const entropy = Math.random();

            const seed = randomBytes32.toString('hex');

            this.logger.debug(
                `Generated PRNG seed at ${timestamp.toISOString()}`,
            );

            return { seed, timestamp, entropy };
        } catch (error) {
            this.logger.error(`Failed to generate PRNG seed: ${error}`);
            throw new InternalServerErrorException(
                'Failed to generate random seed',
            );
        }
    }

    /**
     * Select random index using cryptographic seed
     *
     * Converts hex seed to a number and applies modulo to get valid array index
     * This ensures:
     * - Deterministic selection (same seed = same index)
     * - Uniform distribution across eligible members
     * - Cryptographic randomness (cannot be predicted)
     *
     * @param maxIndex - Maximum index value (array length)
     * @param prngConfig - PRNG configuration with seed
     * @returns Random index between 0 and maxIndex-1
     */
    private selectRandomIndex(maxIndex: number, prngConfig: PRNGConfig): number {
        if (maxIndex <= 0) {
            throw new BadRequestException('maxIndex must be greater than 0');
        }

        if (maxIndex === 1) {
            return 0;
        }

        try {
            // Convert hex seed to a number
            const seedNumber = BigInt(`0x${prngConfig.seed.substring(0, 16)}`);
            // Get modulo to ensure index is within bounds
            const selectedIndex = Number(seedNumber % BigInt(maxIndex));

            this.logger.debug(
                `Selected index: ${selectedIndex} from ${maxIndex} members`,
            );

            return selectedIndex;
        } catch (error) {
            this.logger.error(`Failed to select random index: ${error}`);
            throw new InternalServerErrorException(
                'Failed to select random index',
            );
        }
    }

    /**
     * Execute atomic transaction for winner selection
     *
     * Transaction includes:
     * 1. Insert winner_selections record
     * 2. Update payout_cycles with selected_winner_id and status
     * 3. Mark winner as past_winner in member_eligibility
     * 4. Create payout_history record
     * 5. Create payment_reminder record
     *
     * @param equbId - The equb identifier
     * @param cycleId - The payout cycle identifier
     * @param winner - The selected winner
     * @param memberCount - Total eligible member count
     * @param prngConfig - PRNG configuration with seed
     * @returns Winner selection result
     */
    private async executeWinnerSelectionTransaction(
        equbId: string,
        cycleId: string,
        winner: MemberEligibility,
        memberCount: number,
        prngConfig: PRNGConfig,
    ): Promise<WinnerSelectionResult> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Get cycle details
            const cycle = await queryRunner.manager.findOne('payout_cycles', {
                where: { cycle_id: cycleId },
            });

            if (!cycle) {
                throw new NotFoundException(`Payout cycle ${cycleId} not found`);
            }

            const selectedAt = new Date();

            // 1. Insert winner selection record
            const selectionRecord = {
                selection_id: this.generateId(),
                payout_cycle_id: cycleId,
                winner_id: winner.member_id,
                selection_method: 'LOTTERY',
                selected_at: selectedAt,
                prng_seed: prngConfig.seed,
                is_verified: false,
                created_at: selectedAt,
            };

            await queryRunner.manager.insert('winner_selections', selectionRecord);

            // 2. Update payout_cycles
            await queryRunner.manager.update(
                'payout_cycles',
                { cycle_id: cycleId },
                {
                    selected_winner_id: winner.member_id,
                    status: 'DRAWING',
                    updated_at: selectedAt,
                },
            );

            // 3. Mark winner as past_winner
            await queryRunner.manager.update(
                'member_eligibility_status',
                { payout_cycle_id: cycleId, member_id: winner.member_id },
                { is_past_winner: true, updated_at: selectedAt },
            );

            // 4. Create payout_history record
            const payoutHistoryRecord = {
                history_id: this.generateId(),
                payout_cycle_id: cycleId,
                member_id: winner.member_id,
                payout_amount: cycle.pot_amount,
                status: 'PENDING',
                created_at: selectedAt,
                updated_at: selectedAt,
            };

            await queryRunner.manager.insert(
                'payout_history',
                payoutHistoryRecord,
            );

            // 5. Create payment reminder
            const reminderRecord = {
                reminder_id: this.generateId(),
                winner_id: winner.member_id,
                payout_cycle_id: cycleId,
                reminder_type: 'PAYOUT_READY',
                sent_at: selectedAt,
                is_acknowledged: false,
                created_at: selectedAt,
            };

            await queryRunner.manager.insert(
                'payment_reminders',
                reminderRecord,
            );

            // Commit transaction
            await queryRunner.commitTransaction();

            this.logger.log(
                `Winner selection transaction committed for cycle ${cycleId}`,
            );

            return {
                success: true,
                payoutCycleId: cycleId,
                winnerId: winner.member_id,
                winnerName: winner.member_name,
                winnerPhone: winner.member_phone,
                potAmount: cycle.pot_amount,
                electedAt: selectedAt,
                totalEligibleMembers: memberCount,
                prngSeed: prngConfig.seed,
                message: `${winner.member_name} has been selected as the winner for this cycle!`,
            };
        } catch (error) {
            // Rollback on error
            await queryRunner.rollbackTransaction();
            this.logger.error(
                `Winner selection transaction failed: ${error}`,
            );
            throw new InternalServerErrorException(
                `Failed to record winner selection: ${error instanceof Error ? error.message : 'unknown error'}`,
            );
        } finally {
            // Release connection
            await queryRunner.release();
        }
    }

    /**
     * Create audit log entry for tracking operations
     *
     * @param entry - Audit log entry details
     */
    private async createAuditLog(entry: AuditLogEntry): Promise<void> {
        try {
            await this.repositories.auditLogRepository.insert({
                ...entry,
                id: this.generateId(),
            });
        } catch (error) {
            this.logger.warn(
                `Failed to create audit log entry: ${error instanceof Error ? error.message : 'unknown'}`,
            );
            // Do not throw - audit failures should not block operations
        }
    }

    /**
     * Generate a unique ID
     *
     * @returns UUID v4 string
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Verify reproducibility of winner selection with same PRNG seed
     *
     * @param cycleId - The payout cycle identifier
     * @param seed - The PRNG seed to verify
     * @returns The member ID that would be selected with this seed
     */
    async verifyReproducibility(cycleId: string, seed: string): Promise<string> {
        try {
            const eligibleMembers = await this.getEligibleMembers(cycleId);

            if (eligibleMembers.length === 0) {
                throw new BadRequestException(
                    'No eligible members for reproducibility verification',
                );
            }

            // Simulate selection with provided seed
            const mockConfig: PRNGConfig = {
                seed,
                timestamp: new Date(),
                entropy: 0,
            };

            const index = this.selectRandomIndex(
                eligibleMembers.length,
                mockConfig,
            );
            const selectedMember = eligibleMembers[index];

            this.logger.log(
                `Verified reproducibility for cycle ${cycleId}: seed ${seed} -> member ${selectedMember.member_id}`,
            );

            return selectedMember.member_id;
        } catch (error) {
            this.logger.error(`Failed to verify reproducibility: ${error}`);
            throw new InternalServerErrorException(
                'Failed to verify reproducibility',
            );
        }
    }
}
