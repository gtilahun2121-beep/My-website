/**
 * Phase 2: Recurring Deposit Collection Service
 * Handles deposit collection with cutoff times, reminders, and status tracking
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
import { Cron, CronExpression } from '@nestjs/schedule';
import { EqubTierConfigService, EqubTierType } from './equb-tier-config.service';

export interface DepositRequest {
  equb_id: string;
  member_id: string;
  amount: number;
  payment_method: string;
  transaction_id?: string;
}

export interface CollectionStatus {
  equb_id: string;
  current_round: number;
  expected_amount: number;
  collection_deadline: Date;
  cutoff_time: string;
  collected_count: number;
  pending_count: number;
  defaulted_count: number;
  total_collected: number;
  progress: string;
}

export interface MemberPaymentStatus {
  member_id: string;
  member_name: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'DEFAULTED';
  payment_date?: Date;
  amount: number;
  days_overdue?: number;
  late_fee?: number;
}

@Injectable()
export class Phase2CollectionService {
  private readonly logger = new Logger(Phase2CollectionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tierConfigService: EqubTierConfigService,
  ) {}

  /**
   * Record a deposit from a member
   * @param depositRequest - Deposit request
   * @returns Deposit confirmation
   */
  async recordDeposit(depositRequest: DepositRequest): Promise<any> {
    this.logger.log(
      `[PHASE-2] Recording deposit | Member: ${depositRequest.member_id}, Amount: ${depositRequest.amount}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify equb exists and is active
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [depositRequest.equb_id],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(
          `Equb ${depositRequest.equb_id} not found`,
        );
      }

      const equbRecord = equb[0];
      const tierConfig = this.tierConfigService.getTierConfig(
        equbRecord.tier_type,
      );

      // 2. Verify member is enrolled
      const member = await queryRunner.manager.query(
        `SELECT * FROM equb_members 
         WHERE equb_id = $1 AND member_id = $2 AND status = 'ACTIVE'`,
        [depositRequest.equb_id, depositRequest.member_id],
      );

      if (!member || member.length === 0) {
        throw new BadRequestException(
          `Member ${depositRequest.member_id} is not active in this equb`,
        );
      }

      // 3. Verify deposit amount matches tier contribution
      if (depositRequest.amount !== tierConfig.contribution_amount) {
        throw new BadRequestException(
          `Invalid amount. Expected ${tierConfig.contribution_amount}, got ${depositRequest.amount}`,
        );
      }

      // 4. Get current cycle
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles 
         WHERE equb_id = $1 AND status = 'ACTIVE'
         ORDER BY cycle_number DESC LIMIT 1`,
        [depositRequest.equb_id],
      );

      if (!cycle || cycle.length === 0) {
        throw new BadRequestException(`No active cycle for equb`);
      }

      const cycleRecord = cycle[0];

      // 5. Check if payment already exists for this round
      const existingPayment = await queryRunner.manager.query(
        `SELECT * FROM payments 
         WHERE cycle_id = $1 AND member_id = $2`,
        [cycleRecord.id, depositRequest.member_id],
      );

      if (existingPayment && existingPayment.length > 0) {
        const existing = existingPayment[0];
        if (existing.status === 'PAID') {
          throw new ConflictException(
            `Payment already recorded for this member in this cycle`,
          );
        }
      }

      // 6. Create payment record
      const paymentId = this.generateId('PAY');
      const paidAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO payments 
         (id, cycle_id, equb_id, member_id, amount, payment_method, transaction_id, 
          status, paid_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          paymentId,
          cycleRecord.id,
          depositRequest.equb_id,
          depositRequest.member_id,
          depositRequest.amount,
          depositRequest.payment_method,
          depositRequest.transaction_id || null,
          'PAID',
          paidAt,
          paidAt,
          paidAt,
        ],
      );

      // 7. Update member eligibility
      await queryRunner.manager.query(
        `UPDATE member_eligibility_status 
         SET have_paid_contribution = true, updated_at = $1 
         WHERE cycle_id = $2 AND member_id = $3`,
        [paidAt, cycleRecord.id, depositRequest.member_id],
      );

      // 8. Update collection total
      const totalCollected = await queryRunner.manager.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
         WHERE cycle_id = $1 AND status = 'PAID'`,
        [cycleRecord.id],
      );

      await queryRunner.manager.query(
        `UPDATE payout_cycles 
         SET total_collected = $1, updated_at = $2 
         WHERE id = $3`,
        [totalCollected[0].total, paidAt, cycleRecord.id],
      );

      // 9. Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'DEPOSIT_RECORDED',
          depositRequest.member_id,
          JSON.stringify({
            payment_id: paymentId,
            equb_id: depositRequest.equb_id,
            amount: depositRequest.amount,
            tier_type: equbRecord.tier_type,
          }),
          paidAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-2] ✓ Deposit recorded | ID: ${paymentId}, Amount: ${depositRequest.amount}`,
      );

      return {
        success: true,
        payment_id: paymentId,
        amount: depositRequest.amount,
        status: 'PAID',
        paid_at: paidAt,
        confirmation_message: `Deposit of ${depositRequest.amount} ETB recorded successfully`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-2] Error recording deposit | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get collection status for a cycle
   * @param equbId - Equb ID
   * @param cycleId - Cycle ID
   * @returns Collection status
   */
  async getCollectionStatus(
    equbId: string,
    cycleId: string,
  ): Promise<CollectionStatus> {
    this.logger.log(
      `[PHASE-2] Getting collection status | Equb: ${equbId}, Cycle: ${cycleId}`,
    );

    try {
      // Get equb and cycle
      const equb = await this.dataSource.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [equbId],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb ${equbId} not found`);
      }

      const cycle = await this.dataSource.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1`,
        [cycleId],
      );

      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Cycle ${cycleId} not found`);
      }

      const cycleRecord = cycle[0];
      const equbRecord = equb[0];
      const tierConfig = this.tierConfigService.getTierConfig(
        equbRecord.tier_type,
      );

      // Get payment statistics
      const stats = await this.dataSource.manager.query(
        `SELECT 
           COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
           COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
           COUNT(CASE WHEN status = 'DEFAULTED' THEN 1 END) as defaulted_count,
           COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as total_collected
         FROM payments
         WHERE cycle_id = $1`,
        [cycleId],
      );

      const deadline = this.calculateCollectionDeadline(equbRecord.tier_type);

      return {
        equb_id: equbId,
        current_round: cycleRecord.cycle_number,
        expected_amount: tierConfig.contribution_amount * tierConfig.pool_capacity,
        collection_deadline: deadline,
        cutoff_time: tierConfig.payment_cutoff_time || '17:00',
        collected_count: stats[0].paid_count,
        pending_count: stats[0].pending_count,
        defaulted_count: stats[0].defaulted_count,
        total_collected: stats[0].total_collected,
        progress: `${stats[0].paid_count + stats[0].defaulted_count}/${tierConfig.pool_capacity} members`,
      };
    } catch (error) {
      this.logger.error(
        `[PHASE-2] Error getting status | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get collection status: ${error.message}`,
      );
    }
  }

  /**
   * Get member payment status for a cycle
   * @param equbId - Equb ID
   * @param cycleId - Cycle ID
   * @returns Array of member payment statuses
   */
  async getMemberPaymentStatuses(
    equbId: string,
    cycleId: string,
  ): Promise<MemberPaymentStatus[]> {
    this.logger.log(
      `[PHASE-2] Getting member payment statuses | Equb: ${equbId}`,
    );

    try {
      // Get all members and their payment status
      const members = await this.dataSource.manager.query(
        `SELECT 
           em.member_id, em.member_name,
           CASE 
             WHEN p.status = 'PAID' THEN 'PAID'
             WHEN p.status = 'DEFAULTED' THEN 'DEFAULTED'
             WHEN CURRENT_TIMESTAMP > pc.start_date + INTERVAL '1 day' THEN 'OVERDUE'
             ELSE 'PENDING'
           END as payment_status,
           p.paid_at, p.amount
         FROM equb_members em
         LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $2
         JOIN payout_cycles pc ON pc.id = $2
         WHERE em.equb_id = $1 AND em.status = 'ACTIVE'
         ORDER BY em.member_name`,
        [equbId, cycleId],
      );

      return members.map((m: any) => ({
        member_id: m.member_id,
        member_name: m.member_name,
        status: m.payment_status || 'PENDING',
        payment_date: m.paid_at,
        amount: m.amount || 0,
      }));
    } catch (error) {
      this.logger.error(
        `[PHASE-2] Error getting member statuses | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get member payment statuses: ${error.message}`,
      );
    }
  }

  /**
   * Send payment reminders (scheduled task)
   * Runs at configured intervals to send reminders
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async sendPaymentReminders(): Promise<void> {
    this.logger.log('[PHASE-2] Sending payment reminders (scheduled task)');

    try {
      // Get all active cycles
      const activeCycles = await this.dataSource.manager.query(
        `SELECT * FROM payout_cycles WHERE status = 'ACTIVE'`,
      );

      for (const cycle of activeCycles) {
        // Get members who haven't paid
        const unpaidMembers = await this.dataSource.manager.query(
          `SELECT em.member_id, em.member_name, em.phone, e.tier_type
           FROM equb_members em
           JOIN equbs e ON em.equb_id = e.id
           LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $1
           WHERE em.equb_id = $2 AND em.status = 'ACTIVE' AND p.id IS NULL`,
          [cycle.id, cycle.equb_id],
        );

        // Send reminders
        for (const member of unpaidMembers) {
          await this.sendReminderToMember(member, cycle);
        }
      }
    } catch (error) {
      this.logger.error(
        `[PHASE-2] Error sending reminders | ${error.message}`,
      );
    }
  }

  /**
   * Check for defaults and apply late fees (scheduled task)
   * Runs daily to check for missed payments
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkForDefaults(): Promise<void> {
    this.logger.log('[PHASE-2] Checking for defaults (scheduled task)');

    try {
      // Get all active cycles
      const activeCycles = await this.dataSource.manager.query(
        `SELECT * FROM payout_cycles WHERE status = 'ACTIVE'`,
      );

      for (const cycle of activeCycles) {
        const equb = await this.dataSource.manager.query(
          `SELECT * FROM equbs WHERE id = $1`,
          [cycle.equb_id],
        );

        if (!equb || equb.length === 0) continue;

        const tierConfig = this.tierConfigService.getTierConfig(
          equb[0].tier_type,
        );

        // Find overdue payments
        const overdueMembers = await this.dataSource.manager.query(
          `SELECT em.member_id, em.member_name, p.id as payment_id
           FROM equb_members em
           LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $1
           WHERE em.equb_id = $2 AND em.status = 'ACTIVE'
           AND (p.id IS NULL OR p.status = 'PENDING')
           AND CURRENT_TIMESTAMP > $3 + INTERVAL '1 day'`,
          [cycle.id, cycle.equb_id, cycle.start_date],
        );

        // Apply late fees and mark as defaulted
        for (const member of overdueMembers) {
          await this.applyLateFee(
            member.member_id,
            cycle.id,
            tierConfig.late_fee_percentage,
          );
        }
      }
    } catch (error) {
      this.logger.error(`[PHASE-2] Error checking defaults | ${error.message}`);
    }
  }

  /**
   * PRIVATE: Calculate collection deadline
   */
  private calculateCollectionDeadline(tierType: EqubTierType): Date {
    const now = new Date();
    const deadline = new Date(now);

    switch (tierType) {
      case EqubTierType.DAILY:
        deadline.setDate(deadline.getDate() + 1);
        break;
      case EqubTierType.WEEKLY:
        deadline.setDate(deadline.getDate() + 7);
        break;
      case EqubTierType.MONTHLY:
        deadline.setDate(deadline.getDate() + 30);
        break;
    }

    deadline.setHours(17, 0, 0, 0); // 5 PM cutoff
    return deadline;
  }

  /**
   * PRIVATE: Send reminder to member
   */
  private async sendReminderToMember(member: any, cycle: any): Promise<void> {
    this.logger.log(
      `[PHASE-2] Sending reminder | Member: ${member.member_id}`,
    );
    // Implementation would send SMS/email/push notification
  }

  /**
   * PRIVATE: Apply late fee
   */
  private async applyLateFee(
    memberId: string,
    cycleId: string,
    lateFeePercentage: number,
  ): Promise<void> {
    this.logger.log(`[PHASE-2] Applying late fee | Member: ${memberId}`);
    // Implementation would create penalty record
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
