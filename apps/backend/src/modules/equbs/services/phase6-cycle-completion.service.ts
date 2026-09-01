/**
 * Phase 6: Rotation & Cycle Completion Service
 * Handles cycle rotation, winner marking, and cycle closure
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

export interface CycleCompletionResult {
  equb_id: string;
  completed_cycle: number;
  next_cycle?: number;
  winners: number;
  payouts_completed: number;
  total_cycles: number;
  status: 'COMPLETED' | 'ROTATION_READY' | 'EQUB_CLOSED';
  completion_date: Date;
  message: string;
}

export interface CycleRotationResult {
  equb_id: string;
  new_cycle_number: number;
  start_date: Date;
  end_date: Date;
  duration_days: number;
  tier_type: EqubTierType;
  message: string;
}

@Injectable()
export class Phase6CycleCompletionService {
  private readonly logger = new Logger(Phase6CycleCompletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tierConfigService: EqubTierConfigService,
  ) {}

  /**
   * Complete a cycle and prepare for rotation
   * @param cycleId - Cycle ID
   * @returns Cycle completion result
   */
  async completeCycle(cycleId: string): Promise<CycleCompletionResult> {
    this.logger.log(`[PHASE-6] Completing cycle | Cycle: ${cycleId}`);

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

      // Get equb
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [cycleRecord.equb_id],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb not found`);
      }

      const equbRecord = equb[0];
      const tierConfig = this.tierConfigService.getTierConfig(equbRecord.tier_type);

      // Count winners and completed payouts
      const stats = await queryRunner.manager.query(
        `SELECT 
           COUNT(DISTINCT ws.member_id) as winners_count,
           COUNT(CASE WHEN ph.status = 'COMPLETED' THEN 1 END) as payouts_completed
         FROM winner_selections ws
         LEFT JOIN payout_history ph ON ws.cycle_id = ph.cycle_id
         WHERE ws.cycle_id = $1`,
        [cycleId],
      );

      const completedAt = new Date();

      // Update cycle status
      await queryRunner.manager.query(
        `UPDATE payout_cycles 
         SET status = 'COMPLETED', completed_at = $1, updated_at = $2 
         WHERE id = $3`,
        [completedAt, completedAt, cycleId],
      );

      // Check if all members have won
      const totalMembers = equbRecord.pool_capacity;
      const winnersCount = stats[0].winners_count;

      let completionStatus: 'COMPLETED' | 'ROTATION_READY' | 'EQUB_CLOSED';
      let message: string;
      let nextCycleNumber: number | undefined;

      if (winnersCount === totalMembers) {
        // All members have won - equb is complete
        completionStatus = 'EQUB_CLOSED';
        message = `Equb cycle ${cycleRecord.cycle_number} completed! All ${totalMembers} members have received payouts.`;

        // Mark equb as COMPLETED
        await queryRunner.manager.query(
          `UPDATE equbs SET status = 'COMPLETED', completed_at = $1 WHERE id = $2`,
          [completedAt, cycleRecord.equb_id],
        );

        // Archive cycle
        await queryRunner.manager.query(
          `UPDATE payout_cycles SET archived = true WHERE id = $1`,
          [cycleId],
        );
      } else if (winnersCount > 0) {
        // Some members have won - rotate to next cycle
        completionStatus = 'ROTATION_READY';
        nextCycleNumber = cycleRecord.cycle_number + 1;
        message = `Cycle ${cycleRecord.cycle_number} complete with ${winnersCount} winners. Rotating to cycle ${nextCycleNumber}...`;

        // Create next cycle
        const nextCycleId = this.generateId('CYCLE');
        const nextStartDate = new Date(
          cycleRecord.end_date.getTime() + 1000,
        );
        const nextEndDate = new Date(
          nextStartDate.getTime() + tierConfig.duration_days * 24 * 60 * 60 * 1000,
        );

        await queryRunner.manager.query(
          `INSERT INTO payout_cycles 
           (id, equb_id, cycle_number, start_date, end_date, duration_days, 
            status, total_members, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            nextCycleId,
            cycleRecord.equb_id,
            nextCycleNumber,
            nextStartDate,
            nextEndDate,
            tierConfig.duration_days,
            'ACTIVE',
            totalMembers,
            completedAt,
            completedAt,
          ],
        );

        // Update equb with new cycle
        await queryRunner.manager.query(
          `UPDATE equbs SET current_cycle_id = $1, updated_at = $2 WHERE id = $3`,
          [nextCycleId, completedAt, cycleRecord.equb_id],
        );

        // Reset member eligibility for new cycle
        const members = await queryRunner.manager.query(
          `SELECT member_id FROM equb_members WHERE equb_id = $1 AND status = 'ACTIVE'`,
          [cycleRecord.equb_id],
        );

        for (const member of members) {
          await queryRunner.manager.query(
            `INSERT INTO member_eligibility_status 
             (id, equb_id, cycle_id, member_id, have_paid_contribution, is_past_winner, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              this.generateId('MEL'),
              cycleRecord.equb_id,
              nextCycleId,
              member.member_id,
              false,
              false,
              completedAt,
              completedAt,
            ],
          );
        }
      } else {
        completionStatus = 'COMPLETED';
        message = `Cycle ${cycleRecord.cycle_number} completed with no winners yet.`;
      }

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'CYCLE_COMPLETED',
          'SYSTEM',
          JSON.stringify({
            cycle_id: cycleId,
            cycle_number: cycleRecord.cycle_number,
            winners: winnersCount,
            total_members: totalMembers,
            next_cycle: nextCycleNumber,
            status: completionStatus,
          }),
          completedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-6] ✓ Cycle completed | Status: ${completionStatus}, Winners: ${winnersCount}/${totalMembers}`,
      );

      return {
        equb_id: cycleRecord.equb_id,
        completed_cycle: cycleRecord.cycle_number,
        next_cycle: nextCycleNumber,
        winners: winnersCount,
        payouts_completed: stats[0].payouts_completed,
        total_cycles: cycleRecord.cycle_number,
        status: completionStatus,
        completion_date: completedAt,
        message,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-6] Error completing cycle | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Initiate next cycle rotation
   * @param equbId - Equb ID
   * @returns Rotation result
   */
  async rotateToNextCycle(equbId: string): Promise<CycleRotationResult> {
    this.logger.log(`[PHASE-6] Rotating to next cycle | Equb: ${equbId}`);

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
      const tierConfig = this.tierConfigService.getTierConfig(equbRecord.tier_type);

      // Get last cycle
      const lastCycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles 
         WHERE equb_id = $1 
         ORDER BY cycle_number DESC 
         LIMIT 1`,
        [equbId],
      );

      if (!lastCycle || lastCycle.length === 0) {
        throw new BadRequestException(`No cycles found for equb`);
      }

      const cycleRecord = lastCycle[0];
      const nextCycleNumber = cycleRecord.cycle_number + 1;

      // Create new cycle
      const nextCycleId = this.generateId('CYCLE');
      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + tierConfig.duration_days * 24 * 60 * 60 * 1000,
      );

      const createdAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO payout_cycles 
         (id, equb_id, cycle_number, start_date, end_date, duration_days, 
          status, total_members, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          nextCycleId,
          equbId,
          nextCycleNumber,
          startDate,
          endDate,
          tierConfig.duration_days,
          'ACTIVE',
          equbRecord.pool_capacity,
          createdAt,
          createdAt,
        ],
      );

      // Update equb current cycle
      await queryRunner.manager.query(
        `UPDATE equbs 
         SET current_cycle_id = $1, cycle_status = 'ACTIVE', updated_at = $2 
         WHERE id = $3`,
        [nextCycleId, createdAt, equbId],
      );

      // Reset eligibility for all members
      const members = await queryRunner.manager.query(
        `SELECT member_id FROM equb_members WHERE equb_id = $1 AND status = 'ACTIVE'`,
        [equbId],
      );

      for (const member of members) {
        await queryRunner.manager.query(
          `INSERT INTO member_eligibility_status 
           (id, equb_id, cycle_id, member_id, have_paid_contribution, is_past_winner, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            this.generateId('MEL'),
            equbId,
            nextCycleId,
            member.member_id,
            false,
            false,
            createdAt,
            createdAt,
          ],
        );
      }

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'CYCLE_ROTATED',
          'SYSTEM',
          JSON.stringify({
            equb_id: equbId,
            new_cycle_number: nextCycleNumber,
            cycle_id: nextCycleId,
            start_date: startDate,
            end_date: endDate,
          }),
          createdAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-6] ✓ Rotated to cycle ${nextCycleNumber} | ID: ${nextCycleId}`,
      );

      return {
        equb_id: equbId,
        new_cycle_number: nextCycleNumber,
        start_date: startDate,
        end_date: endDate,
        duration_days: tierConfig.duration_days,
        tier_type: equbRecord.tier_type,
        message: `Equb rotated to cycle ${nextCycleNumber}. Duration: ${tierConfig.duration_days} days.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-6] Error rotating cycle | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get cycle statistics
   * @param equbId - Equb ID
   * @returns Cycle statistics
   */
  async getCycleStatistics(equbId: string): Promise<any> {
    this.logger.log(`[PHASE-6] Getting cycle statistics | Equb: ${equbId}`);

    try {
      const cycles = await this.dataSource.manager.query(
        `SELECT 
           pc.cycle_number,
           pc.status,
           COUNT(DISTINCT ws.member_id) as winners_count,
           COUNT(DISTINCT ph.id) as payouts_count,
           SUM(CASE WHEN ph.status = 'COMPLETED' THEN ph.net_amount ELSE 0 END) as total_paid,
           pc.start_date,
           pc.end_date
         FROM payout_cycles pc
         LEFT JOIN winner_selections ws ON pc.id = ws.cycle_id
         LEFT JOIN payout_history ph ON pc.id = ph.cycle_id
         WHERE pc.equb_id = $1
         GROUP BY pc.cycle_number, pc.status, pc.start_date, pc.end_date
         ORDER BY pc.cycle_number DESC`,
        [equbId],
      );

      return cycles;
    } catch (error) {
      this.logger.error(
        `[PHASE-6] Error getting statistics | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get cycle statistics: ${error.message}`,
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
