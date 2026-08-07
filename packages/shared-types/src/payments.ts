/**
 * Payments & Equb-related shared types.
 */

export interface BidRequest {
    equbId: string;
    amount: number;
}

export interface CheckoutRequest {
    equbId: string;
    paymentMethod: 'chapa' | 'telebirr' | 'wallet';
}

export interface PaymentWebhookPayload {
    transactionId: string;
    status: 'success' | 'failed' | 'pending';
    amount: number;
    provider: 'chapa' | 'telebirr';
    metadata?: Record<string, unknown>;
}

export interface WalletBalance {
    userId: string;
    balance: number;
    currency: string;
}
