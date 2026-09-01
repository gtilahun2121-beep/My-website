/**
 * Payout Disbursement Interfaces
 * Type definitions for payout processing, verification, and reconciliation
 */

export type DisbursementStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'REFUNDED'
    | 'PENDING_VERIFICATION';

export interface PaymentGatewayConfig {
    name: string;
    displayName: string;
    supportedCurrencies: string[];
    processingFee: number;
    supportingBanks: string[];
}

export interface PayoutDisbursementResult {
    success: boolean;
    payoutHistoryId: string;
    transactionId: string;
    memberId: string;
    amount: number;
    paymentGateway: string;
    status: DisbursementStatus;
    disbursedAt: Date;
    message: string;
}

export interface PayoutVerification {
    transactionId: string;
    payoutHistoryId: string;
    memberId: string;
    amount: number;
    status: 'VERIFIED' | 'FAILED' | 'PENDING';
    paymentGateway: string;
    verifiedAt: Date;
    message: string;
}

export interface PaymentReconciliation {
    cycleId: string;
    totalPayouts: number;
    totalAmount: number;
    completed: number;
    pending: number;
    processing: number;
    failed: number;
    refunded: number;
    completionRate: number;
    totalDisbursed: number;
    summary: {
        message: string;
        lastUpdated: Date;
    };
}
