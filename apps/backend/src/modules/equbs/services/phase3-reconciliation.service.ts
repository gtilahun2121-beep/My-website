/**
 * Phase 3: Reconciliation & Default Checks Service
 * Handles payment reconciliation, default detection, and late fee application
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

export interface ReconciliationReport {
  cycle_id: string;
  equb_id: string;
  total_members: number;
  total_expected: number;
  total_collected: number;
  total_defaulted: number;
  collection_rate: number;
  defaulted_members: {
    member_id: string;
    member_name: string;
    days_overdue: number;
    late_fee: number;
  }[];
  reconciliation_date: Date;
  status: 'BALANCED' | 'UNBALANCED' | 'NEEDS_REVIEW';
  message: string;
}

export interface DefaultRecord {
  member_id: string;
  member_name: string;
  phone: string;
  equb_id: string;
  cycle_id: string;
  days_overdue: number;
  expected_payment: number;
  late_fee: number;
  grace_period_remaining: number;
  status: 'WARNING' | 'DEFAULTED' | 'SUSPENDED';
}

@Injectable()
export class Phase3ReconciliationService {
  private readonly logger = new Logger(Phase3ReconciliationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tierConfigService: EqubTierConfigService,
  ) {}

  /**
   * Generate reconciliation report for a cycle
   * @param cycleId - Cycle ID
   * @returns Reconciliation report
   */
  async generateReconciliationReport(cycleId: string): Promise<ReconciliationReport> {
    this.logger.log(`[PHASE-3] Generating reconciliation report | Cycle: ${cycleId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get cycle
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1`,
        [cycleId],
      );

      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Cycle ${cycleId} not found`);
      }

      const cycleRecord = cycle[0];

      // Get equb
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [cycleRecord.equb_id],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb not found`);
      }

      const tierConfig = this.tierConfigService.getTierConfig(equb[0].tier_type);

      // Get payment statistics
      const stats = await queryRunner.manager.query(
        `SELECT 
           COUNT(*) as total_members,
           COUNT(CASE WHEN p.status = 'PAID' THEN 1 END) as paid_count,
           COUNT(CASE WHEN p.status = 'DEFAULTED' THEN 1 END) as defaulted_count,
           COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END), 0) as total_collected
         FROM equb_members em
         LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $1
         WHERE em.equb_id = $2 AND em.status = 'ACTIVE'`,
        [cycleId, cycleRecord.equb_id],
      );

      // Get defaulted members with late fees
      const defaultedMembers = await queryRunner.manager.query(
        `SELECT 
           em.member_id, em.member_name,
           EXTRACT(DAY FROM CURRENT_TIMESTAMP - pc.start_date) as days_overdue,
           $1 as late_fee
         FROM equb_members em
         JOIN payout_cycles pc ON pc.id = $2
         LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $2
         WHERE em.equb_id = $3 AND em.status = 'ACTIVE' 
         AND (p.id IS NULL OR p.status = 'DEFAULTED')
         AND CURRENT_TIMESTAMP > pc.start_date + INTERVAL '1 day'`,
        [this.tierConfigService.calculateLateFee(equb[0].tier_type), cycleId, cycleRecord.equb_id],
      );

      const totalExpected = stats[0].total_members * tierConfig.contribution_amount;
      const collectionRate = totalExpected > 0 ? (stats[0].total_collected / totalExpected) * 100 : 0;

      // Determine status
      let status: 'BALANCED' | 'UNBALANCED' | 'NEEDS_REVIEW';
      if (Math.abs(stats[0].total_collected - totalExpected) < 1) {
        status = 'BALANCED';
      } else if (collectionRate >= 80) {
        status = 'UNBALANCED';
      } else {
        status = 'NEEDS_REVIEW';
      }

      await queryRunner.release();

      const report: ReconciliationReport = {
        cycle_id: cycleId,
        equb_id: cycleRecord.equb_id,
        total_members: stats[0].total_members,
        total_expected: totalExpected,
        total_collected: stats[0].total_collected,
        total_defaulted: stats[0].defaulted_count,
        collection_rate: Math.round(collectionRate * 100) / 100,
        defaulted_members: defaultedMembers,
        reconciliation_date: new Date(),
        status,
        message: `Collection: ${stats[0].total_collected}/${totalExpected} ETB (${collectionRate.toFixed(1)}%)`,
      };

      this.logger.log(`[PHASE-3] ✓ Report generated | Status: ${status}`);

      return report;
    } catch (error) {
      await queryRunner.release();
      this.logger.error(
        `[PHASE-3] Error generating report | ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check for defaults and create records
   * @param cycleId - Cycle ID
   * @returns Default records created
   */
  async checkAndRecordDefaults(cycleId: string): Promise<DefaultRecord[]> {
    this.logger.log(`[PHASE-3] Checking for defaults | Cycle: ${cycleId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get cycle
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1`,
        [cycleId],
      );

      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Cycle ${cycleId} not found`);
      }

      const cycleRecord = cycle[0];

      // Get equb and tier config
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [cycleRecord.equb_id],
      );

      const tierConfig = this.tierConfigService.getTierConfig(equb[0].tier_type);

      // Get members with no payment
      const unpaidMembers = await queryRunner.manager.query(
        `SELECT em.member_id, em.member_name, em.phone, 
                EXTRACT(DAY FROM CURRENT_TIMESTAMP - $1) as days_since_start,
                $2 as grace_period_days
         FROM equb_members em
         LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $3
         WHERE em.equb_id = $4 AND em.status = 'ACTIVE' AND p.id IS NULL`,
        [
          cycleRecord.start_date,
          tierConfig.default_grace_period_days,
          cycleId,
          cycleRecord.equb_id,
        ],
      );

      const defaultRecords: DefaultRecord[] = [];
      const recordedAt = new Date();

      for (const member of unpaidMembers) {
        const daysOverdue = Math.max(0, member.days_since_start - member.grace_period_days);

        if (member.days_since_start > member.grace_period_days) {
          // Member is in default
          const lateFee = this.tierConfigService.calculateLateFee(equb[0].tier_type);

          // Create default record
          const defaultId = this.generateId('DEF');
          await queryRunner.manager.query(
            `INSERT INTO default_records 
             (id, cycle_id, member_id, days_overdue, late_fee, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [defaultId, cycleId, member.member_id, daysOverdue, lateFee, 'DEFAULTED', recordedAt, recordedAt],
          );

          // Update member eligibility
          await queryRunner.manager.query(
            `UPDATE member_eligibility_status 
             SET have_paid_contribution = false, updated_at = $1 
             WHERE cycle_id = $2 AND member_id = $3`,
            [recordedAt, cycleId, member.member_id],
          );

          defaultRecords.push({
            member_id: member.member_id,
            member_name: member.member_name,
            phone: member.phone,
            equb_id: cycleRecord.equb_id,
            cycle_id: cycleId,
            days_overdue: daysOverdue,
            expected_payment: tierConfig.contribution_amount,
            late_fee: lateFee,
            grace_period_remaining: 0,
            status: 'DEFAULTED',
          });
        } else if (member.days_since_start > member.grace_period_days - 2) {
          // Warning stage
          defaultRecords.push({
            member_id: member.member_id,
            member_name: member.member_name,
            phone: member.phone,
            equb_id: cycleRecord.equb_id,
            cycle_id: cycleId,
            days_overdue: 0,
            expected_payment: tierConfig.contribution_amount,
            late_fee: 0,
            grace_period_remaining: member.grace_period_days - member.days_since_start,
            status: 'WARNING',
          });
        }
      }

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'DEFAULT_CHECK_PERFORMED',
          'SYSTEM',
          JSON.stringify({
            cycle_id: cycleId,
            defaults_found: defaultRecords.filter((d) => d.status === 'DEFAULTED').length,
            warnings: defaultRecords.filter((d) => d.status === 'WARNING').length,
          }),
          recordedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-3] ✓ Default check complete | Defaults: ${defaultRecords.filter((d) => d.status === 'DEFAULTED').length}`,
      );

      return defaultRecords;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-3] Error checking defaults | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Apply late fee to a member
   * @param memberId - Member ID
   * @param cycleId - Cycle ID
   * @returns Late fee applied
   */
  async applyLateFee(
    memberId: string,
    cycleId: string,
  ): Promise<{ success: boolean; late_fee: number; message: string }> {
    this.logger.log(
      `[PHASE-3] Applying late fee | Member: ${memberId}, Cycle: ${cycleId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get cycle and equb
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1`,
        [cycleId],
      );

      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Cycle ${cycleId} not found`);
      }

      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [cycle[0].equb_id],
      );

      // Calculate late fee
      const lateFee = this.tierConfigService.calculateLateFee(equb[0].tier_type);

      // Create fee record
      const feeId = this.generateId('FEE');
      const appliedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO late_fees 
         (id, cycle_id, member_id, amount, reason, applied_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [feeId, cycleId, memberId, lateFee, 'MISSED_PAYMENT', appliedAt, appliedAt, appliedAt],
      );

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'LATE_FEE_APPLIED',
          'SYSTEM',
          JSON.stringify({
            member_id: memberId,
            cycle_id: cycleId,
            fee_amount: lateFee,
          }),
          appliedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-3] ✓ Late fee applied | Amount: ${lateFee} ETB`,
      );

      return {
        success: true,
        late_fee: lateFee,
        message: `Late fee of ${lateFee} ETB applied`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-3] Error applying fee | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get default records for a cycle
   * @param cycleId - Cycle ID
   * @returns Default records
   */
  async getDefaultRecords(cycleId: string): Promise<DefaultRecord[]> {
    this.logger.log(`[PHASE-3] Getting default records | Cycle: ${cycleId}`);

    try {
      const records = await this.dataSource.manager.query(
        `SELECT 
           em.member_id, em.member_name, em.phone,
           pc.equb_id, dr.cycle_id,
           EXTRACT(DAY FROM CURRENT_TIMESTAMP - dr.created_at) as days_overdue,
           c.contribution_amount as expected_payment,
           lf.amount as late_fee,
           dr.status
         FROM default_records dr
         JOIN equb_members em ON dr.member_id = em.member_id
         JOIN payout_cycles pc ON dr.cycle_id = pc.id
         JOIN equbs e ON pc.equb_id = e.id
         LEFT JOIN late_fees lf ON dr.cycle_id = lf.cycle_id AND dr.member_id = lf.member_id
         WHERE dr.cycle_id = $1
         ORDER BY dr.created_at DESC`,
        [cycleId],
      );

      return records;
    } catch (error) {
      this.logger.error(
        `[PHASE-3] Error getting records | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get default records: ${error.message}`,
      );
    }
  }

  /**
   * Scheduled reconciliation task
   * Runs daily to reconcile collections
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyReconciliation(): Promise<void> {
    this.logger.log('[PHASE-3] Daily reconciliation task started');

    try {
      // Get all active cycles
      const activeCycles = await this.dataSource.manager.query(
        `SELECT * FROM payout_cycles WHERE status = 'ACTIVE'`,
      );

      for (const cycle of activeCycles) {
        // Generate report
        await this.generateReconciliationReport(cycle.id);

        // Check for defaults
        await this.checkAndRecordDefaults(cycle.id);
      }

      this.logger.log('[PHASE-3] Daily reconciliation completed');
    } catch (error) {
      this.logger.error(`[PHASE-3] Reconciliation error | ${error.message}`);
    }
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
