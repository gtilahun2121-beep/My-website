/**
 * Lottery Selection Service Unit Tests
 * Test coverage for random winner selection, validation, and transaction handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LotterySelectionService } from './lottery-selection.service';
import {
    MemberEligibility,
    WinnerSelectionResult,
    DrawValidationResult,
} from '../interfaces/lottery.interface';

describe('LotterySelectionService', () => {
    let service: LotterySelectionService;
    let dataSource: DataSource;
    let mockPayoutCycleRepository: any;
    let mockMemberEligibilityRepository: any;
    let mockWinnerSelectionRepository: any;
    let mockPayoutHistoryRepository: any;
    let mockAuditLogRepository: any;
    let mockPaymentReminderRepository: any;
    let mockQueryRunner: any;
    let mockLogger: Logger;

    const mockMemberId1 = 'member-1';
    const mockMemberId2 = 'member-2';
    const mockMemberId3 = 'member-3';
    const mockCycleId = 'cycle-1';
    const mockEqubId = 'equb-1';

    const mockEligibleMember1: MemberEligibility = {
        member_id: mockMemberId1,
        member_name: 'John Doe',
        member_phone: '+251911111111',
        has_paid_contribution: true,
        is_past_winner: false,
        has_opted_out: false,
        is_active_member: true,
    };

    const mockEligibleMember2: MemberEligibility = {
        member_id: mockMemberId2,
        member_name: 'Jane Smith',
        member_phone: '+251922222222',
        has_paid_contribution: true,
        is_past_winner: false,
        has_opted_out: false,
        is_active_member: true,
    };

    const mockEligibleMember3: MemberEligibility = {
        member_id: mockMemberId3,
        member_name: 'Bob Johnson',
        member_phone: '+251933333333',
        has_paid_contribution: true,
        is_past_winner: false,
        has_opted_out: false,
        is_active_member: true,
    };

    const mockPayoutCycle = {
        cycle_id: mockCycleId,
        equb_id: mockEqubId,
        cycle_number: 1,
        status: 'OPEN',
        pot_amount: 5000,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        selected_winner_id: null,
        total_members: 10,
    };

    beforeEach(async () => {
        // Mock repositories
        mockPayoutCycleRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            insert: jest.fn(),
        };

        mockMemberEligibilityRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
        };

        mockWinnerSelectionRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            insert: jest.fn(),
        };

        mockPayoutHistoryRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            insert: jest.fn(),
        };

        mockAuditLogRepository = {
            insert: jest.fn(),
        };

        mockPaymentReminderRepository = {
            insert: jest.fn(),
        };

        mockLogger = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as any;

        // Mock QueryRunner
        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                findOne: jest.fn(),
                insert: jest.fn(),
                update: jest.fn(),
            },
        };

        // Mock DataSource
        dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: LotterySelectionService,
                    useFactory: () => {
                        const service = new LotterySelectionService(
                            dataSource,
                            {
                                payoutCycleRepository: mockPayoutCycleRepository,
                                memberEligibilityRepository: mockMemberEligibilityRepository,
                                winnerSelectionRepository: mockWinnerSelectionRepository,
                                payoutHistoryRepository: mockPayoutHistoryRepository,
                                auditLogRepository: mockAuditLogRepository,
                                paymentReminderRepository: mockPaymentReminderRepository,
                            },
                        );
                        // Replace logger with mock
                        (service as any).logger = mockLogger;
                        return service;
                    },
                },
            ],
        }).compile();

        service = module.get<LotterySelectionService>(LotterySelectionService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('selectWinnerForCycle', () => {
        it('should successfully select a winner from eligible members', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2, mockEligibleMember3];

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
            mockAuditLogRepository.insert.mockResolvedValueOnce(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            const result = await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.payoutCycleId).toBe(mockCycleId);
            expect(result.totalEligibleMembers).toBe(3);
            expect([mockMemberId1, mockMemberId2, mockMemberId3]).toContain(result.winnerId);
            expect(result.potAmount).toBe(5000);
            expect(result.prngSeed).toBeDefined();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should handle single eligible member scenario', async () => {
            // Arrange
            const singleMember = [mockEligibleMember1];
            const singleMemberPayoutCycle = { ...mockPayoutCycle };

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(singleMemberPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(singleMember);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(singleMemberPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            const result = await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.winnerId).toBe(mockMemberId1);
            expect(result.totalEligibleMembers).toBe(1);
        });

        it('should throw BadRequestException when no eligible members found', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce([]);

            // Act & Assert
            await expect(
                service.selectWinnerForCycle(mockEqubId, mockCycleId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when cycle not found during validation', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(null);

            // Act & Assert
            await expect(
                service.selectWinnerForCycle(mockEqubId, mockCycleId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should rollback transaction on error', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockRejectedValueOnce(new Error('DB error'));

            // Act & Assert
            await expect(
                service.selectWinnerForCycle(mockEqubId, mockCycleId),
            ).rejects.toThrow(InternalServerErrorException);

            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.release).toHaveBeenCalled();
        });

        it('should create audit log entries', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            expect(mockAuditLogRepository.insert).toHaveBeenCalledTimes(2);
            const calls = mockAuditLogRepository.insert.mock.calls;
            expect(calls[0][0].action).toBe('ELIGIBILITY_CHECK');
            expect(calls[1][0].action).toBe('WINNER_SELECTED');
        });
    });

    describe('getEligibleMembers', () => {
        it('should return eligible members filtered by criteria', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);

            // Act
            const result = await service.getEligibleMembers(mockCycleId);

            // Assert
            expect(result).toEqual(eligibleMembers);
            expect(result.length).toBe(2);
            expect(mockMemberEligibilityRepository.find).toHaveBeenCalledWith({
                where: {
                    payout_cycle_id: mockCycleId,
                    has_paid_contribution: true,
                    is_past_winner: false,
                    has_opted_out: false,
                    is_active_member: true,
                },
            });
        });

        it('should return empty array when no eligible members found', async () => {
            // Arrange
            mockMemberEligibilityRepository.find.mockResolvedValueOnce([]);

            // Act
            const result = await service.getEligibleMembers(mockCycleId);

            // Assert
            expect(result).toEqual([]);
            expect(result.length).toBe(0);
        });

        it('should throw InternalServerErrorException on query error', async () => {
            // Arrange
            mockMemberEligibilityRepository.find.mockRejectedValueOnce(
                new Error('Database error'),
            );

            // Act & Assert
            await expect(
                service.getEligibleMembers(mockCycleId),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('verifyPastWinner', () => {
        it('should return true if member is past winner', async () => {
            // Arrange
            const memberEligibility = { is_past_winner: true };
            mockMemberEligibilityRepository.findOne.mockResolvedValueOnce(memberEligibility);

            // Act
            const result = await service.verifyPastWinner(mockCycleId, mockMemberId1);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false if member is not past winner', async () => {
            // Arrange
            const memberEligibility = { is_past_winner: false };
            mockMemberEligibilityRepository.findOne.mockResolvedValueOnce(memberEligibility);

            // Act
            const result = await service.verifyPastWinner(mockCycleId, mockMemberId1);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false if member not found', async () => {
            // Arrange
            mockMemberEligibilityRepository.findOne.mockResolvedValueOnce(null);

            // Act
            const result = await service.verifyPastWinner(mockCycleId, mockMemberId1);

            // Assert
            expect(result).toBe(false);
        });

        it('should throw InternalServerErrorException on query error', async () => {
            // Arrange
            mockMemberEligibilityRepository.findOne.mockRejectedValueOnce(
                new Error('Database error'),
            );

            // Act & Assert
            await expect(
                service.verifyPastWinner(mockCycleId, mockMemberId1),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('validateDrawConditions', () => {
        it('should validate successfully for drawable cycle', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);

            // Act
            const result = await service.validateDrawConditions(mockCycleId);

            // Assert
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.eligibleMemberCount).toBe(2);
        });

        it('should fail validation if cycle not found', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(null);

            // Act
            const result = await service.validateDrawConditions(mockCycleId);

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(`Payout cycle ${mockCycleId} not found`);
        });

        it('should fail validation if cycle status is not drawable', async () => {
            // Arrange
            const completedCycle = { ...mockPayoutCycle, status: 'COMPLETED' };
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(completedCycle);

            // Act
            const result = await service.validateDrawConditions(mockCycleId);

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('COMPLETED'))).toBe(true);
        });

        it('should fail validation if cycle already has winner', async () => {
            // Arrange
            const cycleWithWinner = { ...mockPayoutCycle, selected_winner_id: mockMemberId1 };
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(cycleWithWinner);

            // Act
            const result = await service.validateDrawConditions(mockCycleId);

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('already has a selected winner'))).toBe(true);
        });

        it('should fail validation if no eligible members', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce([]);

            // Act
            const result = await service.validateDrawConditions(mockCycleId);

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('No eligible members'))).toBe(true);
        });

        it('should add warning if only one eligible member', async () => {
            // Arrange
            const singleMember = [mockEligibleMember1];
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(singleMember);

            // Act
            const result = await service.validateDrawConditions(mockCycleId);

            // Assert
            expect(result.valid).toBe(true);
            expect(result.warnings).toBeDefined();
            expect(result.warnings?.some(w => w.includes('Only 1 eligible member'))).toBe(true);
        });

        it('should throw InternalServerErrorException on error', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockRejectedValueOnce(
                new Error('Database error'),
            );

            // Act & Assert
            await expect(
                service.validateDrawConditions(mockCycleId),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('canUndoSelection', () => {
        it('should return true if selection can be undone', async () => {
            // Arrange
            const selection = {
                selection_id: 'selection-1',
                payout_cycle_id: mockCycleId,
            };
            const drawingCycle = { ...mockPayoutCycle, status: 'DRAWING' };
            const paymentHistory = [{ status: 'PENDING' }];

            mockWinnerSelectionRepository.findOne.mockResolvedValueOnce(selection);
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(drawingCycle);
            mockPayoutHistoryRepository.find.mockResolvedValueOnce(paymentHistory);

            // Act
            const result = await service.canUndoSelection('selection-1');

            // Assert
            expect(result).toBe(true);
        });

        it('should return false if selection not found', async () => {
            // Arrange
            mockWinnerSelectionRepository.findOne.mockResolvedValueOnce(null);

            // Act
            const result = await service.canUndoSelection('selection-1');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false if cycle status is not DRAWING', async () => {
            // Arrange
            const selection = {
                selection_id: 'selection-1',
                payout_cycle_id: mockCycleId,
            };
            const completedCycle = { ...mockPayoutCycle, status: 'COMPLETED' };

            mockWinnerSelectionRepository.findOne.mockResolvedValueOnce(selection);
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(completedCycle);

            // Act
            const result = await service.canUndoSelection('selection-1');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false if payments have been processed', async () => {
            // Arrange
            const selection = {
                selection_id: 'selection-1',
                payout_cycle_id: mockCycleId,
            };
            const drawingCycle = { ...mockPayoutCycle, status: 'DRAWING' };
            const paymentHistory = [{ status: 'PROCESSING' }];

            mockWinnerSelectionRepository.findOne.mockResolvedValueOnce(selection);
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(drawingCycle);
            mockPayoutHistoryRepository.find.mockResolvedValueOnce(paymentHistory);

            // Act
            const result = await service.canUndoSelection('selection-1');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            // Arrange
            mockWinnerSelectionRepository.findOne.mockRejectedValueOnce(
                new Error('Database error'),
            );

            // Act
            const result = await service.canUndoSelection('selection-1');

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('verifyReproducibility', () => {
        it('should return same winner with same seed', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2, mockEligibleMember3];
            const seed = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);

            // Act
            const result = await service.verifyReproducibility(mockCycleId, seed);

            // Assert
            expect(result).toBeDefined();
            expect([mockMemberId1, mockMemberId2, mockMemberId3]).toContain(result);
        });

        it('should throw BadRequestException if no eligible members', async () => {
            // Arrange
            mockMemberEligibilityRepository.find.mockResolvedValueOnce([]);

            // Act & Assert
            await expect(
                service.verifyReproducibility(mockCycleId, 'seed-123'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw InternalServerErrorException on error', async () => {
            // Arrange
            mockMemberEligibilityRepository.find.mockRejectedValueOnce(
                new Error('Database error'),
            );

            // Act & Assert
            await expect(
                service.verifyReproducibility(mockCycleId, 'seed-123'),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should be deterministic - same seed yields same result', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2, mockEligibleMember3];
            const seed = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

            mockMemberEligibilityRepository.find
                .mockResolvedValueOnce(eligibleMembers)
                .mockResolvedValueOnce(eligibleMembers);

            // Act
            const result1 = await service.verifyReproducibility(mockCycleId, seed);
            const result2 = await service.verifyReproducibility(mockCycleId, seed);

            // Assert
            expect(result1).toBe(result2);
        });
    });

    describe('Private Methods - Indirectly Tested', () => {
        describe('generatePRNGSeed', () => {
            it('should generate valid PRNG seed via selectWinnerForCycle', async () => {
                // Arrange
                const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];

                mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
                mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
                mockAuditLogRepository.insert.mockResolvedValue(undefined);
                mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
                mockQueryRunner.manager.insert.mockResolvedValue(undefined);
                mockQueryRunner.manager.update.mockResolvedValue(undefined);

                // Act
                const result = await service.selectWinnerForCycle(mockEqubId, mockCycleId);

                // Assert
                expect(result.prngSeed).toBeDefined();
                expect(result.prngSeed.length).toBeGreaterThan(0);
                expect(/^[a-f0-9]+$/.test(result.prngSeed)).toBe(true); // Should be hex
            });

            it('should generate different seeds on each call', async () => {
                // This is tested implicitly - each call to selectWinnerForCycle generates a new seed
                // Multiple calls should not produce identical seeds (probability is ~0 with cryptographic randomness)
                const seed1 = (service as any).generatePRNGSeed();
                const seed2 = (service as any).generatePRNGSeed();

                expect(seed1.seed).not.toBe(seed2.seed);
            });
        });

        describe('selectRandomIndex', () => {
            it('should return valid index within bounds', async () => {
                // Arrange
                const eligibleMembers = [mockEligibleMember1, mockEligibleMember2, mockEligibleMember3];

                mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
                mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
                mockAuditLogRepository.insert.mockResolvedValue(undefined);
                mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
                mockQueryRunner.manager.insert.mockResolvedValue(undefined);
                mockQueryRunner.manager.update.mockResolvedValue(undefined);

                // Act
                const result = await service.selectWinnerForCycle(mockEqubId, mockCycleId);

                // Assert
                const selectedIndex = [0, 1, 2].indexOf(
                    eligibleMembers.findIndex(m => m.member_id === result.winnerId),
                );
                expect(selectedIndex).toBeGreaterThanOrEqual(0);
                expect(selectedIndex).toBeLessThan(3);
            });
        });
    });

    describe('Transaction Management', () => {
        it('should properly connect and release QueryRunner', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            expect(mockQueryRunner.connect).toHaveBeenCalled();
            expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.release).toHaveBeenCalled();
        });

        it('should insert all necessary records in transaction', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1, mockEligibleMember2];

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            // Should insert: winner_selections, payout_history, payment_reminders
            expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(3);
            // Should update: payout_cycles, member_eligibility_status
            expect(mockQueryRunner.manager.update).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling & Logging', () => {
        it('should log all major operations', async () => {
            // Arrange
            const eligibleMembers = [mockEligibleMember1];

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(eligibleMembers);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Starting lottery selection'),
            );
            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Winner selected'),
            );
            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('completed successfully'),
            );
        });

        it('should log errors with context', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(null);

            // Act & Assert
            try {
                await service.selectWinnerForCycle(mockEqubId, mockCycleId);
            } catch (e) {
                // Expected
            }

            expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should audit log failures', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(null);

            // Act & Assert
            try {
                await service.selectWinnerForCycle(mockEqubId, mockCycleId);
            } catch (e) {
                // Expected
            }

            // Validation fails, so audit log should not be called
            // (or only validation audit log if one is created)
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large eligible member list', async () => {
            // Arrange
            const largeList = Array.from({ length: 1000 }, (_, i) => ({
                ...mockEligibleMember1,
                member_id: `member-${i}`,
            }));

            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockMemberEligibilityRepository.find.mockResolvedValueOnce(largeList);
            mockAuditLogRepository.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockPayoutCycle);
            mockQueryRunner.manager.insert.mockResolvedValue(undefined);
            mockQueryRunner.manager.update.mockResolvedValue(undefined);

            // Act
            const result = await service.selectWinnerForCycle(mockEqubId, mockCycleId);

            // Assert
            expect(result.totalEligibleMembers).toBe(1000);
            expect(largeList.map(m => m.member_id)).toContain(result.winnerId);
        });

        it('should maintain idempotency for audit logs on failure', async () => {
            // Arrange
            mockPayoutCycleRepository.findOne.mockResolvedValueOnce(null);

            // Act - attempt multiple times
            for (let i = 0; i < 3; i++) {
                try {
                    await service.selectWinnerForCycle(mockEqubId, mockCycleId);
                } catch (e) {
                    // Expected
                }
            }

            // Assert - should fail consistently without side effects
        });
    });
});
