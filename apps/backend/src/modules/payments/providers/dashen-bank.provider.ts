/**
 * Dashen Bank Payment Provider
 *
 * Integration with Dashen Bank for bank transfers and mobile banking
 * Supports CBE/DBE integrations and direct bank payments
 */

import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  CheckoutRequest,
  CheckoutResponse,
  VerifyTransactionRequest,
  VerifyTransactionResponse,
  ProviderTransactionStatus,
} from './payment-provider.interface';

interface DashenCheckoutResponse {
  success: boolean;
  data?: {
    checkoutUrl: string;
    sessionId: string;
    reference: string;
  };
  error?: string;
}

interface DashenVerifyResponse {
  success: boolean;
  data?: {
    status: 'completed' | 'pending' | 'failed' | 'cancelled';
    amount: number;
    currency: string;
    reference: string;
  };
  error?: string;
}

export class DashenBankProvider implements PaymentProvider {
  readonly name = 'dashen_bank' as const;
  private readonly logger = new Logger(DashenBankProvider.name);
  private readonly apiUrl = process.env.DASHEN_API_URL || 'https://api.dashenpay.com/v1';
  private readonly apiKey = process.env.DASHEN_API_KEY || '';
  private readonly apiSecret = process.env.DASHEN_API_SECRET || '';
  private readonly merchantId = process.env.DASHEN_MERCHANT_ID || '';

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    try {
      this.logger.log(`Creating Dashen checkout for ${request.amount} ETB`);

      const payload = {
        merchantId: this.merchantId,
        amount: request.amount,
        currency: request.currency,
        reference: request.txRef,
        callbackUrl: request.callbackUrl,
        metadata: request.metadata,
        timestamp: new Date().toISOString(),
      };

      const signature = this.generateSignature(payload);

      const response = await fetch(`${this.apiUrl}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Dashen checkout failed: ${error}`);
        throw new Error(`Dashen API error: ${response.status}`);
      }

      const result: DashenCheckoutResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Unknown Dashen error');
      }

      return {
        checkoutUrl: result.data.checkoutUrl,
        providerReference: result.data.reference,
      };
    } catch (error) {
      this.logger.warn(
        `[Dashen] Checkout init error, falling back to redirect URL: ${(error as Error).message}`,
      );
      return {
        checkoutUrl: `${process.env.DASHEN_CHECKOUT_BASE ?? 'https://pay.dashenbank.et/checkout'}/${request.txRef}`,
        providerReference: `DASHEN-${request.txRef}`,
      };
    }
  }

  async verifyTransaction(
    request: VerifyTransactionRequest,
  ): Promise<VerifyTransactionResponse> {
    try {
      this.logger.log(`Verifying Dashen transaction: ${request.txRef}`);

      const payload = {
        merchantId: this.merchantId,
        reference: request.txRef,
        providerReference: request.providerReference,
        timestamp: new Date().toISOString(),
      };

      const signature = this.generateSignature(payload);

      const response = await fetch(`${this.apiUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`Dashen verification failed: ${response.status}`);
        return {
          status: 'failed',
          verified: false,
          amount: request.amount || 0,
          currency: request.currency || 'ETB',
          txRef: request.txRef,
          failureReason: 'Gateway verification failed',
        };
      }

      const result: DashenVerifyResponse = await response.json();

      if (!result.success || !result.data) {
        return {
          status: 'failed',
          verified: false,
          amount: request.amount || 0,
          currency: request.currency || 'ETB',
          txRef: request.txRef,
          failureReason: result.error || 'Verification failed',
        };
      }

      const statusMap: Record<string, ProviderTransactionStatus> = {
        completed: 'success',
        pending: 'pending',
        failed: 'failed',
        cancelled: 'failed',
      };

      const status = statusMap[result.data.status] || 'failed';
      const verified =
        status === 'success' &&
        (!request.expectedAmount || request.expectedAmount === result.data.amount);

      return {
        status,
        verified,
        amount: result.data.amount,
        currency: result.data.currency,
        txRef: request.txRef,
        providerReference: result.data.reference,
        failureReason: status === 'failed' ? 'Payment failed' : undefined,
      };
    } catch (error) {
      this.logger.error('Dashen verification error:', error);
      return {
        status: 'failed',
        verified: false,
        amount: request.amount || 0,
        currency: request.currency || 'ETB',
        txRef: request.txRef,
        failureReason: 'Verification error',
      };
    }
  }

  async verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
  ): Promise<boolean> {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(rawBody)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      return isValid;
    } catch (error) {
      this.logger.error('Webhook signature verification error:', error);
      return false;
    }
  }

  private generateSignature(payload: any): string {
    const message = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Get list of supported bank codes for Dashen
   * Used for bank transfer verification
   */
  getSupportedBanks(): string[] {
    return ['CBE', 'DBE', 'DASHEN', 'NIBE', 'WBSE'];
  }

  /**
   * Validate bank account number format
   */
  validateBankAccount(
    accountNumber: string,
    bankCode: string,
  ): boolean {
    // Ethiopian bank account validation rules
    // Most Ethiopian banks use 13-digit account numbers
    if (!/^\d{13}$/.test(accountNumber)) {
      return false;
    }

    const validBanks = this.getSupportedBanks();
    return validBanks.includes(bankCode.toUpperCase());
  }
}
