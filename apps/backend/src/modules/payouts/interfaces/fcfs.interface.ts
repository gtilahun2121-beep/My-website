/**
 * FCFS Selection Interfaces
 * Type definitions for the First-Come-First-Served winner selection system
 */

export interface FCFSResult {
    success: boolean;
    cycleId: string;
    equbId: string;
    winnerId: string;
    winnerName: string;
    winnerPhone: string;
    winnerEmail: string;
    joinOrder: number;
    totalMembers: number;
    cycleRound: number;
    potAmount: number;
    selectedAt: Date;
    status: string;
    message: string;
}

export interface SequentialWinner {
    queuePosition: number;
    assignedCycle: number;
    memberId: string;
    memberName: string;
    memberPhone: string;
    joinedAt: Date;
    hasPaidContribution: boolean;
    isPastWinner: boolean;
    status: 'PENDING' | 'COMPLETED';
}

export interface FCFSValidation {
    isValid: boolean;
    errors: string[];
    message: string;
}
