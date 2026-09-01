/**
 * Phase 1: Group Formation & Enrollment Service
 * Handles tier selection, pool matching, and enrollment locking
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
import { EqubTierConfigService, EqubTierType } from './equb-tier-config.service';

export interface EnrollmentRequest {
  equb_id: string;
  user_id: string;
  user_name: string;
  phone: string;
  email: string;
  tier_type: EqubTierType;
}

export interface EnrollmentResult {
  success: boolean;
  enrollment_id: string;
  equb_id: string;
  user_id: string;
  status: 'PENDING_PAYMENT' | 'ENROLLED' | 'POOL_LOCKED';
  members_in_pool: number;
  capacity: number;
  pool_lock_status: string;
  enrollment_date: Date;
  message: string;
}

export interface PoolLockResult {
  equb_id: string;
  tier_type: EqubTierType;
  total_members: number;
  capacity: number;
  pool_locked: boolean;
  cycle_start_date: Date;
  cycle_end_date: Date;
  message: string;
}

@Injectable()
export class Phase1EnrollmentService {
  private readonly logger = new Logger(Phase1EnrollmentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tierConfigService: EqubTierConfigService,
  ) {}

  /**
   * Enroll a user in an equb tier
   * @param enrollmentRequest - Enrollment request data
   * @returns Enrollment result
   */
  async enrollUserInEqub(
    enrollmentRequest: EnrollmentRequest,
  ): Promise<EnrollmentResult> {
    this.logger.log(
      `[PHASE-1] Enrolling user | User: ${enrollmentRequest.user_id}, Equb: ${enrollmentRequest.equb_id}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify equb exists
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [enrollmentRequest.equb_id],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(
          `Equb ${enrollmentRequest.equb_id} not found`,
        );
      }

      const equbRecord = equb[0];

      // 2. Verify tier type matches
      if (equbRecord.tier_type !== enrollmentRequest.tier_type) {
        throw new ConflictException(
          `Equb tier mismatch. Expected ${equbRecord.tier_type}, got ${enrollmentRequest.tier_type}`,
        );
      }

      // 3. Get tier configuration
      const tierConfig = this.tierConfigService.getTierConfig(
        enrollmentRequest.tier_type,
      );

      // 4. Check if user already enrolled
      const existingEnrollment = await queryRunner.manager.query(
        `SELECT * FROM equb_members 
         WHERE equb_id = $1 AND member_id = $2 AND status IN ('PENDING', 'ENROLLED', 'ACTIVE')`,
        [enrollmentRequest.equb_id, enrollmentRequest.user_id],
      );

      if (existingEnrollment && existingEnrollment.length > 0) {
        throw new ConflictException(
          `User already enrolled in this equb with status: ${existingEnrollment[0].status}`,
        );
      }

      // 5. Check pool capacity
      const currentMembers = await queryRunner.manager.query(
        `SELECT COUNT(*) as count FROM equb_members 
         WHERE equb_id = $1 AND status IN ('PENDING', 'ENROLLED', 'ACTIVE')`,
        [enrollmentRequest.equb_id],
      );

      const memberCount = currentMembers[0].count;

      if (memberCount >= tierConfig.pool_capacity) {
        throw new ConflictException(
          `Equb pool is at capacity (${tierConfig.pool_capacity}/${tierConfig.pool_capacity})`,
        );
      }

      // 6. Create enrollment record
      const enrollmentId = this.generateId('ENR');
      const enrolledAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO equb_members 
         (id, equb_id, member_id, member_name, phone, email, tier_type, 
          status, joined_at, have_paid_contribution, is_past_winner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          enrollmentId,
          enrollmentRequest.equb_id,
          enrollmentRequest.user_id,
          enrollmentRequest.user_name,
          enrollmentRequest.phone,
          enrollmentRequest.email,
          enrollmentRequest.tier_type,
          'PENDING_PAYMENT',
          enrolledAt,
          false,
          false,
          enrolledAt,
          enrolledAt,
        ],
      );

      // 7. Create enrollment eligibility record
      await queryRunner.manager.query(
        `INSERT INTO member_eligibility_status 
         (id, equb_id, cycle_id, member_id, have_paid_contribution, is_past_winner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          this.generateId('MEL'),
          enrollmentRequest.equb_id,
          equbRecord.current_cycle_id || `cycle-${enrollmentRequest.equb_id}-1`,
          enrollmentRequest.user_id,
          false,
          false,
          enrolledAt,
          enrolledAt,
        ],
      );

      // 8. Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'ENROLLMENT_INITIATED',
          enrollmentRequest.user_id,
          JSON.stringify({
            enrollment_id: enrollmentId,
            equb_id: enrollmentRequest.equb_id,
            tier_type: enrollmentRequest.tier_type,
          }),
          enrolledAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-1] ✓ User enrolled | ID: ${enrollmentId}, Members: ${memberCount + 1}/${tierConfig.pool_capacity}`,
      );

      // 9. Check if pool should be locked
      const newMemberCount = memberCount + 1;
      const poolLocked = newMemberCount === tierConfig.pool_capacity;

      if (poolLocked) {
        this.logger.log(
          `[PHASE-1] Pool capacity reached! Locking pool...`,
        );
        // Lock pool in background (don't wait)
        this.lockEqubPool(enrollmentRequest.equb_id).catch((err) => {
          this.logger.error(`[PHASE-1] Error locking pool: ${err.message}`);
        });
      }

      return {
        success: true,
        enrollment_id: enrollmentId,
        equb_id: enrollmentRequest.equb_id,
        user_id: enrollmentRequest.user_id,
        status: 'PENDING_PAYMENT',
        members_in_pool: newMemberCount,
        capacity: tierConfig.pool_capacity,
        pool_lock_status:
          poolLocked ? 'LOCKED - Cycle will start' : `${newMemberCount}/${tierConfig.pool_capacity}`,
        enrollment_date: enrolledAt,
        message: poolLocked
          ? `Equb is full! Pool locked. Cycle starts now.`
          : `Enrolled successfully. ${tierConfig.pool_capacity - newMemberCount} more member(s) needed to start.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-1] Error enrolling user | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lock equb pool when capacity is reached
   * @param equbId - Equb ID
   * @returns Pool lock result
   */
  async lockEqubPool(equbId: string): Promise<PoolLockResult> {
    this.logger.log(`[PHASE-1] Locking pool | Equb: ${equbId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get equb
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [equbId],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb ${equbId} not found`);
      }

      const equbRecord = equb[0];
      const tierType = equbRecord.tier_type as EqubTierType;
      const tierConfig = this.tierConfigService.getTierConfig(tierType);

      // Count enrolled members
      const members = await queryRunner.manager.query(
        `SELECT COUNT(*) as count FROM equb_members 
         WHERE equb_id = $1 AND status IN ('PENDING_PAYMENT', 'ENROLLED', 'ACTIVE')`,
        [equbId],
      );

      const memberCount = members[0].count;

      if (memberCount < tierConfig.pool_capacity) {
        throw new ConflictException(
          `Cannot lock pool. Not at capacity (${memberCount}/${tierConfig.pool_capacity})`,
        );
      }

      // Update equb status
      const lockedAt = new Date();
      await queryRunner.manager.query(
        `UPDATE equbs SET status = 'POOL_LOCKED', locked_at = $1, updated_at = $2 WHERE id = $3`,
        [lockedAt, lockedAt, equbId],
      );

      // Update all members to ACTIVE status
      await queryRunner.manager.query(
        `UPDATE equb_members SET status = 'ACTIVE', activated_at = $1 WHERE equb_id = $2`,
        [lockedAt, equbId],
      );

      // Create cycle and start it
      const cycleId = this.generateId('CYCLE');
      const cycleStartDate = lockedAt;
      const cycleEndDate = new Date(
        cycleStartDate.getTime() + tierConfig.duration_days * 24 * 60 * 60 * 1000,
      );

      await queryRunner.manager.query(
        `INSERT INTO payout_cycles 
         (id, equb_id, cycle_number, start_date, end_date, duration_days, 
          status, total_members, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          cycleId,
          equbId,
          1,
          cycleStartDate,
          cycleEndDate,
          tierConfig.duration_days,
          'ACTIVE',
          memberCount,
          lockedAt,
          lockedAt,
        ],
      );

      // Update equb with cycle info
      await queryRunner.manager.query(
        `UPDATE equbs SET current_cycle_id = $1, cycle_status = 'ACTIVE' WHERE id = $2`,
        [cycleId, equbId],
      );

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'POOL_LOCKED',
          'SYSTEM',
          JSON.stringify({
            equb_id: equbId,
            tier_type: tierType,
            members: memberCount,
            cycle_id: cycleId,
            cycle_start: cycleStartDate,
            cycle_end: cycleEndDate,
          }),
          lockedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-1] ✓ Pool locked | Members: ${memberCount}, Cycle: ${cycleId}`,
      );

      return {
        equb_id: equbId,
        tier_type: tierType,
        total_members: memberCount,
        capacity: tierConfig.pool_capacity,
        pool_locked: true,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate,
        message: `Pool locked with ${memberCount} members. Cycle starts now.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-1] Error locking pool | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get enrollment status for a user
   * @param equbId - Equb ID
   * @param userId - User ID
   * @returns Enrollment status
   */
  async getEnrollmentStatus(equbId: string, userId: string): Promise<any> {
    this.logger.log(
      `[PHASE-1] Getting enrollment status | User: ${userId}, Equb: ${equbId}`,
    );

    try {
      const enrollment = await this.dataSource.manager.query(
        `SELECT em.*, e.tier_type, e.pool_capacity 
         FROM equb_members em
         JOIN equbs e ON em.equb_id = e.id
         WHERE em.equb_id = $1 AND em.member_id = $2`,
        [equbId, userId],
      );

      if (!enrollment || enrollment.length === 0) {
        return {
          enrolled: false,
          message: 'User not enrolled in this equb',
        };
      }

      return {
        enrolled: true,
        enrollment_id: enrollment[0].id,
        status: enrollment[0].status,
        joined_at: enrollment[0].joined_at,
        tier_type: enrollment[0].tier_type,
        message: `User is ${enrollment[0].status}`,
      };
    } catch (error) {
      this.logger.error(
        `[PHASE-1] Error getting status | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get enrollment status: ${error.message}`,
      );
    }
  }

  /**
   * Get equb pool status
   * @param equbId - Equb ID
   * @returns Pool status
   */
  async getPoolStatus(equbId: string): Promise<any> {
    this.logger.log(`[PHASE-1] Getting pool status | Equb: ${equbId}`);

    try {
      const equb = await this.dataSource.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [equbId],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb ${equbId} not found`);
      }

      const equbRecord = equb[0];
      const tierConfig = this.tierConfigService.getTierConfig(
        equbRecord.tier_type,
      );

      const members = await this.dataSource.manager.query(
        `SELECT COUNT(*) as count FROM equb_members 
         WHERE equb_id = $1 AND status IN ('PENDING_PAYMENT', 'ENROLLED', 'ACTIVE')`,
        [equbId],
      );

      const memberCount = members[0].count;
      const availableSlots = tierConfig.pool_capacity - memberCount;

      return {
        equb_id: equbId,
        tier_type: equbRecord.tier_type,
        status: equbRecord.status,
        members: memberCount,
        capacity: tierConfig.pool_capacity,
        available_slots: availableSlots,
        is_full: memberCount === tierConfig.pool_capacity,
        progress: `${memberCount}/${tierConfig.pool_capacity} members`,
        message:
          availableSlots === 0
            ? 'Pool is full!'
            : `${availableSlots} slot(s) available`,
      };
    } catch (error) {
      this.logger.error(
        `[PHASE-1] Error getting pool status | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get pool status: ${error.message}`,
      );
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
