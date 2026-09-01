/**
 * Prime Option Interfaces
 * Type definitions for priority payout bidding system
 */

export type BidResolutionStrategy =
    | 'HIGHEST_BID'
    | 'FIRST_SUBMITTED'
    | 'CUSTOM';

export interface PrimeOptionRequest {
    id: string;
    cycle_id: string;
    member_id: string;
    bid_amount: number;
    bid_type: 'PERCENTAGE' | 'FIXED';
    actual_bid_amount: number;
    status: 'ACTIVE' | 'SELECTED' | 'REJECTED' | 'CANCELLED';
    submitted_at: Date;
}

export interface PrimeOptionResult {
    success: boolean;
    primeOptionId: string;
    cycleId: string;
    memberId: string;
    winnerName?: string;
    winnerPhone?: string;
    winnerEmail?: string;
    bidAmount?: number;
    actualBidAmount?: number;
    potAmount?: number;
    totalBidsReceived?: number;
    resolutionStrategy?: BidResolutionStrategy;
    queuePosition?: number;
    bidType?: 'PERCENTAGE' | 'FIXED';
    status?: string;
    submittedAt?: Date;
    selectedAt?: Date;
    message: string;
}

export interface BidValidationResult {
    isValid: boolean;
    errors: string[];
    message: string;
}

export interface PriorityQueueEntry {
    queuePosition: number;
    primeOptionId: string;
    memberId: string;
    memberName: string;
    memberPhone: string;
    bidAmount: number;
    bidType: 'PERCENTAGE' | 'FIXED';
    actualBidAmount: number;
    submittedAt: Date;
    status: string;
}

export interface FeeDistributionResult {
    success: boolean;
    cycleId: string;
    feeAmount: number;
    recipientCount: number;
    perMemberShare: number;
    message: string;
}
