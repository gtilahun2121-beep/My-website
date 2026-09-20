/**
 * Lottery Selection Interfaces
 * Core type definitions for the random winner selection system
 */

export interface MemberEligibility {
    member_id: string;
    member_name: string;
    member_phone: string;
    has_paid_contribution: boolean;
    is_past_winner: boolean;
    has_opted_out: boolean;
    is_active_member: boolean;
}

export interface PayoutCycleInfo {
    cycle_id: string;
    equb_id: string;
    cycle_number: number;
    status: 'OPEN' | 'DRAWING' | 'COMPLETED' | 'CANCELLED';
    pot_amount: number;
    start_date: Date;
    end_date: Date;
    selected_winner_id?: string;
    total_members: number;
}

export interface WinnerSelectionResult {
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

export interface WinnerSelectionRecord {
    selection_id: string;
    payout_cycle_id: string;
    winner_id: string;
    selection_method: 'LOTTERY' | 'MANUAL' | 'ROTATION';
    selected_at: Date;
    prng_seed: string;
    is_verified: boolean;
    created_at: Date;
}

export interface PayoutHistoryRecord {
    history_id: string;
    payout_cycle_id: string;
    member_id: string;
    payout_amount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    created_at: Date;
    updated_at: Date;
}

export interface PaymentReminderRecord {
    reminder_id: string;
    winner_id: string;
    payout_cycle_id: string;
    reminder_type: 'PAYOUT_READY' | 'PAYOUT_REMINDER' | 'PAYOUT_OVERDUE';
    sent_at: Date;
    is_acknowledged: boolean;
}

export interface DrawValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
    eligibleMemberCount?: number;
    eligibleMembers?: MemberEligibility[];
}

export interface AuditLogEntry {
    action: string;
    cycleId: string;
    equbId: string;
    performedBy: string;
    memberCount?: number;
    winnerId?: string;
    details?: Record<string, any>;
    timestamp: Date;
}

export interface PRNGConfig {
    seed: string;
    timestamp: Date;
    entropy: number;
}
