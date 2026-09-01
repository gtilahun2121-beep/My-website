/**
 * Payout Disbursement Service
 * Handles payment processing through multiple gateways and direct transfers
 * Manages payout verification, reconciliation, and error handling
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  PayoutDisbursementResult,
  PaymentGatewayConfig,
  DisbursementStatus,
  PayoutVerification,
  PaymentReconciliation,
} from '../interfaces/payout-disbursement.interface';

/**
 * Payment Gateway Adapters
 */
interface PaymentGateway {
  name: string;
  process(amount: number, phone: string, metadata: any): Promise<{ transactionId: string; status: string }>;
  verify(transactionId: string): Promise<{ status: string; amount: number }>;
  refund(transactionId: string, amount: number): Promise<{ status: string }>;
}

/**
 * Repository injection interface
 */
interface RepositoryCollection {
  payoutHistoryRepository: any;
  paymentReminderRepository: any;
  auditLogRepository: any;
  payoutVerificationRepository: any;
  winnerSelectionRepository: any;
  payoutCycleRepository: any;
}

@Injectable()
export class PayoutDisbursementService {
  private readonly logger = new Logger(PayoutDisbursementService.name);

  // Payment gateway configurations
  private readonly gateways: Map<string, PaymentGateway> = new Map();

  constructor(
    private readonly dataSource: DataSource,
    private readonly repositories: RepositoryCollection,
  ) {
    this.initializeGateways();
  }

  /**
   * Initialize payment gateway adapters
   */
  private initializeGateways(): void {
    this.logger.log('[DISBURSEMENT] Initializing payment gateways');

    // Telebirr Gateway
    this.gateways.set('telebirr', {
      name: 'Telebirr',
      process: async (amount, phone, metadata) => {
        return this.processViaTelebirr(amount, phone, metadata);
      },
      verify: async (transactionId) => {
        return this.verifyTelebirrTransaction(transactionId);
      },
      refund: async (transactionId, amount) => {
        return this.refundViaTebirr(transactionId, amount);
      },
    });

    // CBE Bank Gateway
    this.gateways.set('cbe', {
      name: 'CBE Bank',
      process: async (amount, phone, metadata) => {
        return this.processViaCBE(amount, phone, metadata);
      },
      verify: async (transactionId) => {
        return this.verifyCBETransaction(transactionId);
      },
      refund: async (transactionId, amount) => {
        return this.refundViaCBE(transactionId, amount);
      },
    });

    // Abyssinia Bank Gateway
    this.gateways.set('abyssinia', {
      name: 'Abyssinia Bank',
      process: async (amount, phone, metadata) => {
        return this.processViaAbyssinia(amount, phone, metadata);
      },
      verify: async (transactionId) => {
        return this.verifyAbyssiniaTransaction(transactionId);
      },
      refund: async (transactionId, amount) => {
        return this.refundViaAbyssinia(transactionId, amount);
      },
    });

    // Dashen Bank Gateway
    this.gateways.set('dashen', {
      name: 'Dashen Bank',
      process: async (amount, phone, metadata) => {
        return this.processViaDashen(amount, phone, metadata);
      },
      verify: async (transactionId) => {
        return this.verifyDashenTransaction(transactionId);
      },
      refund: async (transactionId, amount) => {
        return this.refundViaDashen(transactionId, amount);
      },
    });

    // Awash Bank Gateway
    this.gateways.set('awash', {
      name: 'Awash Bank',
      process: async (amount, phone, metadata) => {
        return this.processViaAwash(amount, phone, metadata);
      },
      verify: async (transactionId) => {
        return this.verifyAwashTransaction(transactionId);
      },
      refund: async (transactionId, amount) => {
        return this.refundViaAwash(transactionId, amount);
      },
    });

    // NIB Gateway
    this.gateways.set('nib', {
      name: 'NIB',
      process: async (amount, phone, metadata) => {
        return this.processViaNIB(amount, phone, metadata);
      },
      verify: async (transactionId) => {
        return this.verifyNIBTransaction(transactionId);
      },
      refund: async (transactionId, amount) => {
        return this.refundViaNIB(transactionId, amount);
      },
    });

    this.logger.log('[DISBURSEMENT] Payment gateways initialized (6 gateways)');
  }

  /**
   * Process payout disbursement to winner
   * @param payoutHistoryId - Payout history record ID
   * @param paymentMethod - Payment method/gateway
   * @returns DisbursementResult
   */
  async disbursePayout(
    payoutHistoryId: string,
    paymentMethod: string = 'telebirr',
  ): Promise<PayoutDisbursementResult> {
    this.logger.log(
      `[DISBURSEMENT] Processing payout | ID: ${payoutHistoryId}, Method: ${paymentMethod}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get payout history record
      const payoutHistory = await queryRunner.manager.query(
        `SELECT * FROM payout_history WHERE id = $1`,
        [payoutHistoryId],
      );

      if (!payoutHistory || payoutHistory.length === 0) {
        throw new NotFoundException(`Payout history ${payoutHistoryId} not found`);
      }

      const payout = payoutHistory[0];

      // 2. Verify payout status is PENDING
      if (payout.status !== 'PENDING') {
        throw new ConflictException(
          `Payout is in ${payout.status} status. Cannot process.`,
        );
      }

      // 3. Get member details
      const member = await queryRunner.manager.query(
        `SELECT * FROM members WHERE id = $1`,
        [payout.member_id],
      );

      if (!member || member.length === 0) {
        throw new NotFoundException(`Member ${payout.member_id} not found`);
      }

      // 4. Get winner selection details
      const winnerSelection = await queryRunner.manager.query(
        `SELECT * FROM winner_selections WHERE cycle_id = $1 AND member_id = $2`,
        [payout.cycle_id, payout.member_id],
      );

      if (!winnerSelection || winnerSelection.length === 0) {
        throw new NotFoundException(
          `Winner selection record not found`,
        );
      }

      // 5. Validate payment gateway
      const gateway = this.gateways.get(paymentMethod.toLowerCase());
      if (!gateway) {
        throw new BadRequestException(
          `Payment method ${paymentMethod} not supported. Available: ${Array.from(this.gateways.keys()).join(', ')}`,
        );
      }

      // 6. Update payout status to PROCESSING
      const processingAt = new Date();
      await queryRunner.manager.query(
        `UPDATE payout_history SET status = 'PROCESSING', updated_at = $1 WHERE id = $2`,
        [processingAt, payoutHistoryId],
      );

      // 7. Process payment through gateway
      let transactionId: string;
      let gatewayStatus: string;

      try {
        const gatewayResult = await gateway.process(
          payout.amount,
          member[0].phone,
          {
            payoutHistoryId,
            memberId: payout.member_id,
            cycleId: payout.cycle_id,
            winnerSelectionMethod: winnerSelection[0].selection_method,
          },
        );

        transactionId = gatewayResult.transactionId;
        gatewayStatus = gatewayResult.status;
      } catch (gatewayError) {
        this.logger.error(
          `[DISBURSEMENT] Gateway error | ${gatewayError.message}`,
        );

        // Mark as failed
        await queryRunner.manager.query(
          `UPDATE payout_history 
           SET status = 'FAILED', error_message = $1, updated_at = $2 
           WHERE id = $3`,
          [gatewayError.message, new Date(), payoutHistoryId],
        );

        await queryRunner.commitTransaction();

        throw new InternalServerErrorException(
          `Payment processing failed: ${gatewayError.message}`,
        );
      }

      // 8. Create payout verification record
      const verificationId = this.generateId('PV');
      const verifiedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO payout_verification 
         (id, payout_history_id, transaction_id, payment_gateway, status, verified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          verificationId,
          payoutHistoryId,
          transactionId,
          gateway.name,
          gatewayStatus === 'SUCCESS' ? 'VERIFIED' : 'PENDING',
          verifiedAt,
          verifiedAt,
          verifiedAt,
        ],
      );

      // 9. Update payout status based on gateway response
      const finalStatus = gatewayStatus === 'SUCCESS' ? 'COMPLETED' : 'PENDING_VERIFICATION';
      await queryRunner.manager.query(
        `UPDATE payout_history 
         SET status = $1, transaction_id = $2, payment_gateway = $3, updated_at = $4 
         WHERE id = $5`,
        [finalStatus, transactionId, gateway.name, new Date(), payoutHistoryId],
      );

      // 10. Create payment reminder if not immediately completed
      if (finalStatus !== 'COMPLETED') {
        const reminderMinutes = 30; // Follow up after 30 minutes
        const remindAt = new Date(Date.now() + reminderMinutes * 60 * 1000);

        const reminderId = this.generateId('PR');
        await queryRunner.manager.query(
          `INSERT INTO payment_reminders 
           (id, cycle_id, member_id, payout_history_id, reminder_type, scheduled_for, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            reminderId,
            payout.cycle_id,
            payout.member_id,
            payoutHistoryId,
            'PAYMENT_VERIFICATION',
            remindAt,
            new Date(),
            new Date(),
          ],
        );
      }

      // 11. Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PAYOUT_DISBURSED',
          'SYSTEM',
          JSON.stringify({
            payout_history_id: payoutHistoryId,
            member_id: payout.member_id,
            amount: payout.amount,
            gateway: gateway.name,
            transaction_id: transactionId,
            status: finalStatus,
          }),
          new Date(),
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[DISBURSEMENT] Payout processed | Amount: ${payout.amount} ETB, Gateway: ${gateway.name}, Status: ${finalStatus}`,
      );

      return {
        success: true,
        payoutHistoryId,
        transactionId,
        memberId: payout.member_id,
        amount: payout.amount,
        paymentGateway: gateway.name,
        status: finalStatus,
        disbursedAt: processingAt,
        message: `Payout of ${payout.amount} ETB disbursed via ${gateway.name}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[DISBURSEMENT] Error processing payout | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Verify payout with payment gateway
   * @param transactionId - Transaction ID from payment gateway
   * @returns Verification result
   */
  async verifyPaymentStatus(transactionId: string): Promise<PayoutVerification> {
    this.logger.log(`[DISBURSEMENT] Verifying payment | TX: ${transactionId}`);

    try {
      // Get payout verification record
      const verification = await this.repositories.payoutVerificationRepository.findOne({
        transaction_id: transactionId,
      });

      if (!verification) {
        throw new NotFoundException(`Transaction ${transactionId} not found`);
      }

      // Get corresponding payout history
      const payout = await this.repositories.payoutHistoryRepository.findOne(
        verification.payout_history_id,
      );

      if (!payout) {
        throw new NotFoundException(`Payout history not found`);
      }

      // Get payment gateway adapter
      const gateway = this.gateways.get(
        payout.payment_gateway.toLowerCase(),
      );

      if (!gateway) {
        throw new BadRequestException(
          `Gateway ${payout.payment_gateway} not available`,
        );
      }

      // Verify with gateway
      const gatewayVerification = await gateway.verify(transactionId);

      // Update verification record
      const verifiedAt = new Date();
      await this.repositories.payoutVerificationRepository.update(
        verification.id,
        {
          status: gatewayVerification.status === 'SUCCESS' ? 'VERIFIED' : 'FAILED',
          updated_at: verifiedAt,
        },
      );

      // If verified and payout was pending, mark as completed
      if (
        gatewayVerification.status === 'SUCCESS' &&
        payout.status === 'PENDING_VERIFICATION'
      ) {
        await this.repositories.payoutHistoryRepository.update(payout.id, {
          status: 'COMPLETED',
          updated_at: verifiedAt,
        });
      }

      return {
        transactionId,
        payoutHistoryId: payout.id,
        memberId: payout.member_id,
        amount: payout.amount,
        status: gatewayVerification.status === 'SUCCESS' ? 'VERIFIED' : 'FAILED',
        paymentGateway: payout.payment_gateway,
        verifiedAt,
        message:
          gatewayVerification.status === 'SUCCESS'
            ? 'Payment verified successfully'
            : 'Payment verification failed',
      };
    } catch (error) {
      this.logger.error(
        `[DISBURSEMENT] Error verifying payment | ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process refund for a failed payout
   * @param payoutHistoryId - Payout history ID
   * @returns Refund result
   */
  async refundPayout(payoutHistoryId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`[DISBURSEMENT] Processing refund | Payout: ${payoutHistoryId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get payout history
      const payout = await queryRunner.manager.query(
        `SELECT * FROM payout_history WHERE id = $1`,
        [payoutHistoryId],
      );

      if (!payout || payout.length === 0) {
        throw new NotFoundException(`Payout ${payoutHistoryId} not found`);
      }

      // Get verification record
      const verification = await queryRunner.manager.query(
        `SELECT * FROM payout_verification WHERE payout_history_id = $1`,
        [payoutHistoryId],
      );

      if (!verification || verification.length === 0) {
        throw new BadRequestException(
          `No payment record found for this payout`,
        );
      }

      const gateway = this.gateways.get(payout[0].payment_gateway.toLowerCase());
      if (!gateway) {
        throw new BadRequestException(
          `Gateway ${payout[0].payment_gateway} not available`,
        );
      }

      // Process refund
      const refundResult = await gateway.refund(
        verification[0].transaction_id,
        payout[0].amount,
      );

      // Update payout status
      const refundedAt = new Date();
      await queryRunner.manager.query(
        `UPDATE payout_history 
         SET status = 'REFUNDED', refunded_at = $1, updated_at = $2 
         WHERE id = $3`,
        [refundedAt, refundedAt, payoutHistoryId],
      );

      // Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PAYOUT_REFUNDED',
          'SYSTEM',
          JSON.stringify({
            payout_history_id: payoutHistoryId,
            amount: payout[0].amount,
            gateway: payout[0].payment_gateway,
            transaction_id: verification[0].transaction_id,
          }),
          refundedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[DISBURSEMENT] Refund processed | Amount: ${payout[0].amount} ETB`,
      );

      return {
        success: true,
        message: `Refund of ${payout[0].amount} ETB processed successfully`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[DISBURSEMENT] Error processing refund | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get payout reconciliation report
   * @param cycleId - Payout cycle ID
   * @returns Reconciliation data
   */
  async getPayoutReconciliation(cycleId: string): Promise<PaymentReconciliation> {
    this.logger.log(`[DISBURSEMENT] Generating reconciliation | Cycle: ${cycleId}`);

    try {
      const payouts = await this.repositories.payoutHistoryRepository.find({
        cycle_id: cycleId,
      });

      const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);
      const completed = payouts.filter((p) => p.status === 'COMPLETED').length;
      const pending = payouts.filter((p) => p.status === 'PENDING').length;
      const processing = payouts.filter((p) => p.status === 'PROCESSING').length;
      const failed = payouts.filter((p) => p.status === 'FAILED').length;
      const refunded = payouts.filter((p) => p.status === 'REFUNDED').length;

      const completedAmount = payouts
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        cycleId,
        totalPayouts: payouts.length,
        totalAmount,
        completed,
        pending,
        processing,
        failed,
        refunded,
        completionRate: payouts.length > 0 ? (completed / payouts.length) * 100 : 0,
        totalDisbursed: completedAmount,
        summary: {
          message: `Cycle ${cycleId}: ${completed}/${payouts.length} payouts completed (${completedAmount} ETB disbursed)`,
          lastUpdated: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `[DISBURSEMENT] Error generating reconciliation | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to generate reconciliation: ${error.message}`,
      );
    }
  }

  /**
   * PRIVATE: Gateway implementations (mocked for now)
   */
  private async processViaTelebirr(amount: number, phone: string, metadata: any): Promise<any> {
    this.logger.log(`[TELEBIRR] Processing payment | Amount: ${amount}, Phone: ${phone}`);
    // Mock implementation
    return {
      transactionId: `TBR-${Date.now()}`,
      status: 'SUCCESS',
    };
  }

  private async verifyTelebirrTransaction(transactionId: string): Promise<any> {
    this.logger.log(`[TELEBIRR] Verifying transaction | TX: ${transactionId}`);
    return { status: 'SUCCESS', amount: 0 };
  }

  private async refundViaTebirr(transactionId: string, amount: number): Promise<any> {
    this.logger.log(`[TELEBIRR] Processing refund | TX: ${transactionId}, Amount: ${amount}`);
    return { status: 'SUCCESS' };
  }

  private async processViaCBE(amount: number, phone: string, metadata: any): Promise<any> {
    this.logger.log(`[CBE] Processing payment | Amount: ${amount}, Phone: ${phone}`);
    return { transactionId: `CBE-${Date.now()}`, status: 'SUCCESS' };
  }

  private async verifyCBETransaction(transactionId: string): Promise<any> {
    this.logger.log(`[CBE] Verifying transaction | TX: ${transactionId}`);
    return { status: 'SUCCESS', amount: 0 };
  }

  private async refundViaCBE(transactionId: string, amount: number): Promise<any> {
    this.logger.log(`[CBE] Processing refund | TX: ${transactionId}, Amount: ${amount}`);
    return { status: 'SUCCESS' };
  }

  private async processViaAbyssinia(amount: number, phone: string, metadata: any): Promise<any> {
    this.logger.log(`[ABYSSINIA] Processing payment | Amount: ${amount}, Phone: ${phone}`);
    return { transactionId: `ABY-${Date.now()}`, status: 'SUCCESS' };
  }

  private async verifyAbyssiniaTransaction(transactionId: string): Promise<any> {
    this.logger.log(`[ABYSSINIA] Verifying transaction | TX: ${transactionId}`);
    return { status: 'SUCCESS', amount: 0 };
  }

  private async refundViaAbyssinia(transactionId: string, amount: number): Promise<any> {
    this.logger.log(`[ABYSSINIA] Processing refund | TX: ${transactionId}, Amount: ${amount}`);
    return { status: 'SUCCESS' };
  }

  private async processViaDashen(amount: number, phone: string, metadata: any): Promise<any> {
    this.logger.log(`[DASHEN] Processing payment | Amount: ${amount}, Phone: ${phone}`);
    return { transactionId: `DSH-${Date.now()}`, status: 'SUCCESS' };
  }

  private async verifyDashenTransaction(transactionId: string): Promise<any> {
    this.logger.log(`[DASHEN] Verifying transaction | TX: ${transactionId}`);
    return { status: 'SUCCESS', amount: 0 };
  }

  private async refundViaDashen(transactionId: string, amount: number): Promise<any> {
    this.logger.log(`[DASHEN] Processing refund | TX: ${transactionId}, Amount: ${amount}`);
    return { status: 'SUCCESS' };
  }

  private async processViaAwash(amount: number, phone: string, metadata: any): Promise<any> {
    this.logger.log(`[AWASH] Processing payment | Amount: ${amount}, Phone: ${phone}`);
    return { transactionId: `AWH-${Date.now()}`, status: 'SUCCESS' };
  }

  private async verifyAwashTransaction(transactionId: string): Promise<any> {
    this.logger.log(`[AWASH] Verifying transaction | TX: ${transactionId}`);
    return { status: 'SUCCESS', amount: 0 };
  }

  private async refundViaAwash(transactionId: string, amount: number): Promise<any> {
    this.logger.log(`[AWASH] Processing refund | TX: ${transactionId}, Amount: ${amount}`);
    return { status: 'SUCCESS' };
  }

  private async processViaNIB(amount: number, phone: string, metadata: any): Promise<any> {
    this.logger.log(`[NIB] Processing payment | Amount: ${amount}, Phone: ${phone}`);
    return { transactionId: `NIB-${Date.now()}`, status: 'SUCCESS' };
  }

  private async verifyNIBTransaction(transactionId: string): Promise<any> {
    this.logger.log(`[NIB] Verifying transaction | TX: ${transactionId}`);
    return { status: 'SUCCESS', amount: 0 };
  }

  private async refundViaNIB(transactionId: string, amount: number): Promise<any> {
    this.logger.log(`[NIB] Processing refund | TX: ${transactionId}, Amount: ${amount}`);
    return { status: 'SUCCESS' };
  }

  /**
   * PRIVATE: Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${randomPart}`;
  }
}
