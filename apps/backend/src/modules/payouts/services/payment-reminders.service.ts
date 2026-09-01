/**
 * Payment Reminders & Risk Management Service
 * Handles automated payment reminders, default prevention, and early winner verification
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  ReminderResult,
  RiskAssessment,
  CollateralRequest,
  DefaultPrevention,
} from '../interfaces/payment-reminders.interface';

/**
 * Repository injection interface
 */
interface RepositoryCollection {
  paymentReminderRepository: any;
  payoutHistoryRepository: any;
  memberEligibilityRepository: any;
  winnerSelectionRepository: any;
  collateralRepository: any;
  auditLogRepository: any;
}

@Injectable()
export class PaymentRemindersService {
  private readonly logger = new Logger(PaymentRemindersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repositories: RepositoryCollection,
  ) {}

  /**
   * Create payment reminder for pending payout
   * @param payoutHistoryId - Payout history ID
   * @param reminderType - Type of reminder
   * @param delayMinutes - Minutes to delay reminder
   * @returns Reminder result
   */
  async createPaymentReminder(
    payoutHistoryId: string,
    reminderType: string,
    delayMinutes: number = 30,
  ): Promise<ReminderResult> {
    this.logger.log(
      `[REMINDERS] Creating reminder | Payout: ${payoutHistoryId}, Type: ${reminderType}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get payout history
      const payout = await queryRunner.manager.query(
        `SELECT * FROM payout_history WHERE id = $1`,
        [payoutHistoryId],
      );

      if (!payout || payout.length === 0) {
        throw new NotFoundException(`Payout ${payoutHistoryId} not found`);
      }

      // 2. Create reminder record
      const reminderId = this.generateId('REM');
      const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
      const createdAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO payment_reminders 
         (id, cycle_id, member_id, payout_history_id, reminder_type, 
          scheduled_for, status, attempt_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          reminderId,
          payout[0].cycle_id,
          payout[0].member_id,
          payoutHistoryId,
          reminderType,
          scheduledFor,
          'PENDING',
          0,
          createdAt,
          createdAt,
        ],
      );

      // 3. Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PAYMENT_REMINDER_CREATED',
          'SYSTEM',
          JSON.stringify({
            reminder_id: reminderId,
            payout_history_id: payoutHistoryId,
            reminder_type: reminderType,
            scheduled_for: scheduledFor,
          }),
          createdAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[REMINDERS] Reminder created | ID: ${reminderId}, Scheduled: ${scheduledFor}`,
      );

      return {
        success: true,
        reminderId,
        payoutHistoryId,
        reminderType,
        scheduledFor,
        message: `Reminder scheduled for ${scheduledFor}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[REMINDERS] Error creating reminder | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process due reminders (scheduled task)
   * Runs every 5 minutes to check and process due reminders
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processDueReminders(): Promise<void> {
    this.logger.log('[REMINDERS] Processing due reminders (scheduled task)');

    try {
      // Get all pending reminders that are due
      const dueReminders = await this.repositories.paymentReminderRepository.find({
        status: 'PENDING',
        scheduled_for: { $lte: new Date() },
      });

      if (!dueReminders || dueReminders.length === 0) {
        return;
      }

      this.logger.log(`[REMINDERS] Found ${dueReminders.length} due reminders`);

      for (const reminder of dueReminders) {
        await this.processSingleReminder(reminder);
      }
    } catch (error) {
      this.logger.error(
        `[REMINDERS] Error processing reminders | ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process a single reminder
   */
  private async processSingleReminder(reminder: any): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get payout details
      const payout = await queryRunner.manager.query(
        `SELECT * FROM payout_history WHERE id = $1`,
        [reminder.payout_history_id],
      );

      if (!payout || payout.length === 0) {
        return;
      }

      // Get member details
      const member = await queryRunner.manager.query(
        `SELECT * FROM members WHERE id = $1`,
        [reminder.member_id],
      );

      if (!member || member.length === 0) {
        return;
      }

      // Process based on reminder type
      switch (reminder.reminder_type) {
        case 'PAYOUT_READY':
          await this.sendPayoutReadyNotification(queryRunner, member[0], payout[0]);
          break;
        case 'PAYMENT_VERIFICATION':
          await this.sendPaymentVerificationReminder(queryRunner, member[0], payout[0]);
          break;
        case 'CONTRIBUTION_DUE':
          await this.sendContributionDueReminder(queryRunner, member[0], payout[0]);
          break;
        case 'DEFAULT_WARNING':
          await this.sendDefaultWarning(queryRunner, member[0], payout[0]);
          break;
      }

      // Update reminder status
      const updatedAt = new Date();
      await queryRunner.manager.query(
        `UPDATE payment_reminders 
         SET status = 'SENT', last_sent_at = $1, updated_at = $2 
         WHERE id = $3`,
        [updatedAt, updatedAt, reminder.id],
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[REMINDERS] Error processing reminder ${reminder.id} | ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Assess risk for early winner
   * @param cycleId - Payout cycle ID
   * @param memberId - Member ID
   * @returns Risk assessment result
   */
  async assessEarlyWinnerRisk(
    cycleId: string,
    memberId: string,
  ): Promise<RiskAssessment> {
    this.logger.log(
      `[REMINDERS] Assessing early winner risk | Member: ${memberId}, Cycle: ${cycleId}`,
    );

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      // Get member history
      const memberHistory = await queryRunner.manager.query(
        `SELECT * FROM members WHERE id = $1`,
        [memberId],
      );

      if (!memberHistory || memberHistory.length === 0) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      const member = memberHistory[0];

      // Get payment history
      const payments = await queryRunner.manager.query(
        `SELECT * FROM payout_history WHERE member_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [memberId],
      );

      // Calculate risk score
      let riskScore = 0;
      const riskFactors: string[] = [];

      // 1. Check payment defaults
      const failedPayments = payments.filter((p: any) => p.status === 'FAILED').length;
      if (failedPayments > 0) {
        riskScore += 20 * failedPayments;
        riskFactors.push(`${failedPayments} failed payments`);
      }

      // 2. Check contribution history
      const memberEligibility = await queryRunner.manager.query(
        `SELECT * FROM member_eligibility_status WHERE member_id = $1 AND cycle_id = $2`,
        [memberId, cycleId],
      );

      if (memberEligibility && memberEligibility.length > 0) {
        if (!memberEligibility[0].have_paid_contribution) {
          riskScore += 30;
          riskFactors.push('Incomplete contributions for current cycle');
        }
      }

      // 3. Check member verification status
      if (!member.is_verified) {
        riskScore += 25;
        riskFactors.push('Member not fully verified');
      }

      // 4. Check membership duration
      const joinDate = new Date(member.created_at);
      const daysMember = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysMember < 30) {
        riskScore += 15;
        riskFactors.push('Recent member (less than 30 days)');
      }

      await queryRunner.release();

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      if (riskScore < 25) {
        riskLevel = 'LOW';
      } else if (riskScore < 50) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'HIGH';
      }

      return {
        memberId,
        cycleId,
        riskScore,
        riskLevel,
        riskFactors,
        requiresCollateral: riskLevel === 'HIGH',
        requiresVerification: riskLevel === 'MEDIUM' || riskLevel === 'HIGH',
        message: `Risk assessment: ${riskLevel} (Score: ${riskScore}/100)`,
      };
    } catch (error) {
      this.logger.error(
        `[REMINDERS] Error assessing risk | ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Request collateral from early winner
   * @param memberId - Member ID
   * @param amount - Collateral amount
   * @param reason - Reason for collateral
   * @returns Collateral request result
   */
  async requestCollateral(
    memberId: string,
    amount: number,
    reason: string,
  ): Promise<CollateralRequest> {
    this.logger.log(
      `[REMINDERS] Requesting collateral | Member: ${memberId}, Amount: ${amount}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verify member exists
      const member = await queryRunner.manager.query(
        `SELECT * FROM members WHERE id = $1`,
        [memberId],
      );

      if (!member || member.length === 0) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      // Create collateral request
      const collateralId = this.generateId('COL');
      const createdAt = new Date();
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Due in 24 hours

      await queryRunner.manager.query(
        `INSERT INTO collateral_requests 
         (id, member_id, amount, reason, status, due_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          collateralId,
          memberId,
          amount,
          reason,
          'PENDING',
          dueAt,
          createdAt,
          createdAt,
        ],
      );

      // Create notification/reminder
      const reminderId = this.generateId('REM');
      await queryRunner.manager.query(
        `INSERT INTO payment_reminders 
         (id, member_id, reminder_type, scheduled_for, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reminderId,
          memberId,
          'COLLATERAL_REQUEST',
          createdAt,
          createdAt,
          createdAt,
        ],
      );

      // Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'COLLATERAL_REQUESTED',
          'SYSTEM',
          JSON.stringify({
            collateral_id: collateralId,
            member_id: memberId,
            amount,
            reason,
            due_at: dueAt,
          }),
          createdAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(`[REMINDERS] Collateral request created | ID: ${collateralId}`);

      return {
        success: true,
        collateralId,
        memberId,
        amount,
        reason,
        dueAt,
        status: 'PENDING',
        message: `Collateral request of ${amount} ETB created. Due by ${dueAt}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[REMINDERS] Error requesting collateral | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle default prevention (mark member for close monitoring)
   * @param memberId - Member ID
   * @returns Default prevention result
   */
  async createDefaultPrevention(memberId: string): Promise<DefaultPrevention> {
    this.logger.log(`[REMINDERS] Creating default prevention | Member: ${memberId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get member
      const member = await queryRunner.manager.query(
        `SELECT * FROM members WHERE id = $1`,
        [memberId],
      );

      if (!member || member.length === 0) {
        throw new NotFoundException(`Member ${memberId} not found`);
      }

      // Create prevention record
      const preventionId = this.generateId('DP');
      const createdAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO default_prevention_records 
         (id, member_id, status, monitoring_level, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          preventionId,
          memberId,
          'ACTIVE',
          'HIGH',
          createdAt,
          createdAt,
        ],
      );

      // Set high-frequency reminders
      const reminderTypes = [
        'CONTRIBUTION_DUE',
        'PAYMENT_STATUS_CHECK',
        'PERFORMANCE_REVIEW',
      ];

      for (const reminderType of reminderTypes) {
        const reminderId = this.generateId('REM');
        await queryRunner.manager.query(
          `INSERT INTO payment_reminders 
           (id, member_id, reminder_type, scheduled_for, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            reminderId,
            memberId,
            reminderType,
            new Date(),
            createdAt,
            createdAt,
          ],
        );
      }

      // Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'DEFAULT_PREVENTION_CREATED',
          'SYSTEM',
          JSON.stringify({
            prevention_id: preventionId,
            member_id: memberId,
            monitoring_level: 'HIGH',
          }),
          createdAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[REMINDERS] Default prevention created | ID: ${preventionId}`,
      );

      return {
        success: true,
        preventionId,
        memberId,
        status: 'ACTIVE',
        monitoringLevel: 'HIGH',
        message: `Member ${memberId} placed under close monitoring`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[REMINDERS] Error creating prevention | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * PRIVATE: Send payout ready notification
   */
  private async sendPayoutReadyNotification(
    queryRunner: any,
    member: any,
    payout: any,
  ): Promise<void> {
    this.logger.log(
      `[REMINDERS] Sending payout ready notification | Member: ${member.id}`,
    );
    // Implementation would send SMS/email/push notification
  }

  /**
   * PRIVATE: Send payment verification reminder
   */
  private async sendPaymentVerificationReminder(
    queryRunner: any,
    member: any,
    payout: any,
  ): Promise<void> {
    this.logger.log(
      `[REMINDERS] Sending verification reminder | Member: ${member.id}`,
    );
    // Implementation would send SMS/email/push notification
  }

  /**
   * PRIVATE: Send contribution due reminder
   */
  private async sendContributionDueReminder(
    queryRunner: any,
    member: any,
    payout: any,
  ): Promise<void> {
    this.logger.log(
      `[REMINDERS] Sending contribution due reminder | Member: ${member.id}`,
    );
    // Implementation would send SMS/email/push notification
  }

  /**
   * PRIVATE: Send default warning
   */
  private async sendDefaultWarning(
    queryRunner: any,
    member: any,
    payout: any,
  ): Promise<void> {
    this.logger.log(
      `[REMINDERS] Sending default warning | Member: ${member.id}`,
    );
    // Implementation would send SMS/email/push notification
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
