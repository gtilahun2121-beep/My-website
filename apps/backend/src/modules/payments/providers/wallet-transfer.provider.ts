/**
 * Wallet-to-Wallet Transfer Provider
 *
 * Internal QalNet wallet transfers between users.
 * Used for user-to-user payments and wallet funding.
 * No external gateway - direct database transaction.
 */

import { Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PaymentProvider,
  CheckoutRequest,
  CheckoutResponse,
  VerifyTransactionRequest,
  VerifyTransactionResponse,
} from './payment-provider.interface';

interface WalletTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class WalletTransferProvider implements PaymentProvider {
  readonly name = 'wallet' as const;
  private readonly logger = new Logger(WalletTransferProvider.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Create a wallet transfer checkout.
   * For internal transfers this only validates the parties and reserves a
   * pending transfer row — the actual movement happens in verifyTransaction.
   */
  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    this.logger.log(`Creating wallet transfer for ${request.amount} ETB`);

    const metadata = (request.metadata ?? {}) as any;
    const fromUserId = metadata.fromUserId || metadata.userId;
    const toUserId = metadata.toUserId;

    if (!fromUserId) {
      throw new BadRequestException('Source user required for wallet transfer');
    }
    if (!toUserId) {
      throw new BadRequestException('Recipient user ID required for wallet transfer');
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    // Validate both parties exist
    const users = await this.dataSource.query(
      'SELECT id FROM users WHERE id = ANY($1)',
      [[fromUserId, toUserId]],
    );
    if (!users || users.length < 2) {
      throw new BadRequestException('Recipient or source user not found');
    }

    // Create transfer record
    const transfer = await this.dataSource.query(
      `INSERT INTO wallet_transfers (from_user_id, to_user_id, amount, reference, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [fromUserId, toUserId, request.amount, request.txRef],
    );

    return {
      checkoutUrl: '', // No external URL for internal transfer
      providerReference: transfer[0].id,
    };
  }

  /**
   * Complete a wallet transfer: moves funds between wallets and writes the
   * deposit/withdrawal ledger rows atomically.
   */
  async verifyTransaction(
    request: VerifyTransactionRequest,
  ): Promise<VerifyTransactionResponse> {
    try {
      this.logger.log(`Verifying wallet transfer: ${request.txRef}`);

      const result = await this.dataSource.transaction(async (tx) => {
        // Get transfer record
        const transfer = await tx.query(
          `SELECT * FROM wallet_transfers WHERE reference = $1`,
          [request.txRef],
        );

        if (!transfer || transfer.length === 0) {
          return {
            status: 'failed' as const,
            verified: false,
            amount: request.amount || 0,
            currency: 'ETB',
            txRef: request.txRef,
            failureReason: 'Transfer not found',
          };
        }

        const xfer = transfer[0];

        // Verify amount matches
        const expected = request.expectedAmount ?? request.amount;
        if (expected !== undefined && Math.abs(Number(expected) - Number(xfer.amount)) > 0.01) {
          return {
            status: 'failed' as const,
            verified: false,
            amount: xfer.amount,
            currency: 'ETB',
            txRef: request.txRef,
            failureReason: 'Amount mismatch',
          };
        }

        // Check if already completed
        if (xfer.status === 'completed') {
          return {
            status: 'success' as const,
            verified: true,
            amount: xfer.amount,
            currency: 'ETB',
            txRef: request.txRef,
            providerReference: xfer.id,
          };
        }

        if (xfer.status === 'failed') {
          return {
            status: 'failed' as const,
            verified: false,
            amount: xfer.amount,
            currency: 'ETB',
            txRef: request.txRef,
            failureReason: 'Transfer previously failed',
          };
        }

        // Lock the source wallet
        const sourceWallet = await tx.query(
          `SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
          [xfer.from_user_id],
        );

        if (!sourceWallet || sourceWallet.length === 0) {
          await tx.query(
            'UPDATE wallet_transfers SET status = $1, completed_at = NOW() WHERE id = $2',
            ['failed', xfer.id],
          );
          return {
            status: 'failed' as const,
            verified: false,
            amount: xfer.amount,
            currency: 'ETB',
            txRef: request.txRef,
            failureReason: 'Source wallet not found',
          };
        }

        // Check balance
        if (Number(sourceWallet[0].balance) < Number(xfer.amount)) {
          await tx.query(
            'UPDATE wallet_transfers SET status = $1, completed_at = NOW() WHERE id = $2',
            ['failed', xfer.id],
          );
          return {
            status: 'failed' as const,
            verified: false,
            amount: xfer.amount,
            currency: 'ETB',
            txRef: request.txRef,
            failureReason: 'Insufficient balance',
          };
        }

        // Destination wallet
        const destWallet = await tx.query(
          'SELECT id, user_id FROM wallets WHERE user_id = $1',
          [xfer.to_user_id],
        );

        if (!destWallet || destWallet.length === 0) {
          await tx.query(
            'UPDATE wallet_transfers SET status = $1, completed_at = NOW() WHERE id = $2',
            ['failed', xfer.id],
          );
          return {
            status: 'failed' as const,
            verified: false,
            amount: xfer.amount,
            currency: 'ETB',
            txRef: request.txRef,
            failureReason: 'Destination wallet not found',
          };
        }

        // Perform transfer
        await tx.query(
          'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
          [xfer.amount, sourceWallet[0].id],
        );
        await tx.query(
          'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [xfer.amount, destWallet[0].id],
        );

        // Mark the transfer complete
        await tx.query(
          "UPDATE wallet_transfers SET status = 'completed', completed_at = NOW() WHERE id = $1",
          [xfer.id],
        );

        // Ledger rows — distinct references because wallet_transactions.reference is UNIQUE
        await tx.query(
          `INSERT INTO wallet_transactions (user_id, direction, amount, reference)
           VALUES ($1, 'withdrawal', $2, $3)`,
          [xfer.from_user_id, xfer.amount, `${request.txRef}-out`],
        );
        await tx.query(
          `INSERT INTO wallet_transactions (user_id, direction, amount, reference)
           VALUES ($1, 'deposit', $2, $3)`,
          [xfer.to_user_id, xfer.amount, `${request.txRef}-in`],
        );

        return {
          status: 'success' as const,
          verified: true,
          amount: xfer.amount,
          currency: 'ETB',
          txRef: request.txRef,
          providerReference: xfer.id,
        };
      });

      return result;
    } catch (error) {
      this.logger.error('Wallet transfer verification error:', error);
      return {
        status: 'failed',
        verified: false,
        amount: request.amount || 0,
        currency: 'ETB',
        txRef: request.txRef,
        failureReason: 'Verification error',
      };
    }
  }

  /**
   * No webhook signature needed for internal transfers
   */
  async verifyWebhookSignature(_rawBody: Buffer, _signature: string): Promise<boolean> {
    return true;
  }

  /**
   * Get wallet balance for user
   */
  async getWalletBalance(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId],
    );

    if (!result || result.length === 0) {
      return 0;
    }

    return parseFloat(result[0].balance);
  }

  /**
   * Get transfer history for user
   */
  async getTransferHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<WalletTransfer[]> {
    const transfers = await this.dataSource.query(
      `SELECT * FROM wallet_transfers
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return transfers;
  }
}