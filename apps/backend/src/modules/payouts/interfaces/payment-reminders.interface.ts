/**
 * Payment Reminders & Risk Management Interfaces
 * Type definitions for automated reminders, default prevention, and risk assessment
 */

export interface ReminderResult {
    success: boolean;
    reminderId: string;
    payoutHistoryId: string;
    reminderType: string;
    scheduledFor: Date;
    message: string;
}

export interface RiskAssessment {
    memberId: string;
    cycleId: string;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFactors: string[];
    requiresCollateral: boolean;
    requiresVerification: boolean;
    message: string;
}

export interface CollateralRequest {
    success: boolean;
    collateralId: string;
    memberId: string;
    amount: number;
    reason: string;
    dueAt: Date;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    message: string;
}

export interface DefaultPrevention {
    success: boolean;
    preventionId: string;
    memberId: string;
    status: 'ACTIVE' | 'INACTIVE';
    monitoringLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
}
