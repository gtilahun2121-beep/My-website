/**
 * Lottery Selection DTOs
 * Data Transfer Objects for lottery winner selection operations
 */

import { IsString, IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for initiating a lottery draw
 */
export class InitiateLotteryDrawDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    equbId: string;

    @IsString()
    @IsNotEmpty()
    @IsUUID()
    cycleId: string;
}

/**
 * Response DTO for successful winner selection
 */
export class WinnerSelectionResponseDto {
    success: boolean;

    payoutCycleId: string;

    winnerId: string;

    winnerName: string;

    winnerPhone: string;

    potAmount: number;

    electedAt: Date;

    totalEligibleMembers: number;

    prngSeed: string;

    message: string;
}

/**
 * DTO for eligible members list
 */
export class MemberEligibilityDto {
    member_id: string;

    member_name: string;

    member_phone: string;

    has_paid_contribution: boolean;

    is_past_winner: boolean;

    has_opted_out: boolean;

    is_active_member: boolean;
}

/**
 * DTO for draw validation response
 */
export class DrawValidationResponseDto {
    valid: boolean;

    errors: string[];

    warnings?: string[];

    eligibleMemberCount?: number;
}

/**
 * DTO for past winner verification
 */
export class PastWinnerVerificationDto {
    cycleId: string;

    memberId: string;

    isPastWinner: boolean;
}

/**
 * DTO for undo selection request
 */
export class UndoSelectionDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    selectionId: string;

    reason?: string;
}

/**
 * DTO for undo selection response
 */
export class UndoSelectionResponseDto {
    success: boolean;

    message: string;

    previousWinnerId?: string;

    cycleId?: string;
}

/**
 * DTO for winner selection details
 */
export class WinnerSelectionDetailsDto {
    selection_id: string;

    payout_cycle_id: string;

    winner_id: string;

    winner_name: string;

    selection_method: 'LOTTERY' | 'MANUAL' | 'ROTATION';

    selected_at: Date;

    prng_seed: string;

    is_verified: boolean;

    @Type(() => Date)
    created_at: Date;
}

/**
 * DTO for payout history
 */
export class PayoutHistoryDto {
    history_id: string;

    payout_cycle_id: string;

    member_id: string;

    payout_amount: number;

    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

    @Type(() => Date)
    created_at: Date;

    @Type(() => Date)
    updated_at: Date;
}

/**
 * DTO for audit log entry
 */
export class AuditLogEntryDto {
    action: string;

    cycleId: string;

    equbId: string;

    performedBy: string;

    memberCount?: number;

    winnerId?: string;

    details?: Record<string, any>;

    @Type(() => Date)
    timestamp: Date;
}

/**
 * DTO for reproducibility verification
 */
export class VerifyReproducibilityDto {
    @IsString()
    @IsNotEmpty()
    cycleId: string;

    @IsString()
    @IsNotEmpty()
    prngSeed: string;

    winnerIdToVerify: string;
}

/**
 * DTO for reproducibility verification response
 */
export class VerifyReproducibilityResponseDto {
    isValid: boolean;

    expectedWinnerId: string;

    actualWinnerId: string;

    message: string;
}
