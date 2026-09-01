/**
 * Equb Lifecycle Orchestrator Service
 * Coordinates all 6 phases of the equb operational lifecycle
 * Manages state transitions, phase sequencing, and end-to-end workflows
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
import { Phase1EnrollmentService } from './phase1-enrollment.service';
import { Phase2CollectionService } from './phase2-collection.service';
import { Phase3ReconciliationService } from './phase3-reconciliation.service';
import { Phase4WinnerEngineService } from './phase4-winner-engine.service';
import { Phase6CycleCompletionService } from './phase6-cycle-completion.service';

export enum EqubPhase {
  PHASE_1_ENROLLMENT = 'PHASE_1_ENROLLMENT',
  PHASE_2_COLLECTION = 'PHASE_2_COLLECTION',
  PHASE_3_RECONCILIATION = 'PHASE_3_RECONCILIATION',
  PHASE_4_WINNER_ALLOCATION = 'PHASE_4_WINNER_ALLOCATION',
  PHASE_5_PAYOUT_VERIFICATION = 'PHASE_5_PAYOUT_VERIFICATION',
  PHASE_6_CYCLE_COMPLETION = 'PHASE_6_CYCLE_COMPLETION',
}

export interface EqubLifecycleStatus {
  equb_id: string;
  equb_name: string;
  tier_type: EqubTierType;
  current_phase: EqubPhase;
  current_cycle: number;
  total_members: number;
  pool_capacity: number;
  status: string;
  phase_progress: {
    [key in EqubPhase]: {
      completed: boolean;
      last_executed: Date | null;
    };
  };
  next_phase: EqubPhase | null;
  estimated_phase_end: Date;
  health_score: number; // 0-100
  issues: string[];
}

export interface WorkflowTransitionResult {
  equb_id: string;
  from_phase: EqubPhase;
  to_phase: EqubPhase;
  transition_time: Date;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  message: string;
  details?: any;
}

@Injectable()
export class EqubLifecycleOrchestratorService {
  private readonly logger = new Logger(EqubLifecycleOrchestratorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tierConfigService: EqubTierConfigService,
    private readonly phase1Service: Phase1EnrollmentService,
    private readonly phase2Service: Phase2CollectionService,
    private readonly phase3Service: Phase3ReconciliationService,
    private readonly phase4Service: Phase4WinnerEngineService,
    private readonly phase6Service: Phase6CycleCompletionService,
  ) {}

  /**
   * Get complete lifecycle status for an equb
   * @param equbId - Equb ID
   * @returns Lifecycle status
   */
  async getLifecycleStatus(equbId: string): Promise<EqubLifecycleStatus> {
    this.logger.log(`[ORCHESTRATOR] Getting lifecycle status | Equb: ${equbId}`);

    try {
      // Get equb
      const equb = await this.dataSource.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [equbId],
      );

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb ${equbId} not found`);
      }

      const equbRecord = equb[0];

      // Get current cycle
      const cycle = await this.dataSource.manager.query(
        `SELECT * FROM payout_cycles 
         WHERE equb_id = $1 
         ORDER BY cycle_number DESC 
         LIMIT 1`,
        [equbId],
      );

      const cycleRecord = cycle[0];

      // Determine current phase
      const currentPhase = this.determineCurrentPhase(equbRecord, cycleRecord);

      // Get phase execution history
      const phaseHistory = await this.dataSource.manager.query(
        `SELECT action, created_at FROM audit_logs 
         WHERE details LIKE $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [`%${equbId}%`],
      );

      // Calculate health score
      const healthScore = await this.calculateHealthScore(equbId, cycleRecord.id);

      // Get issues
      const issues = await this.identifyIssues(equbId, cycleRecord.id);

      const tierConfig = this.tierConfigService.getTierConfig(equbRecord.tier_type);

      return {
        equb_id: equbId,
        equb_name: equbRecord.name,
        tier_type: equbRecord.tier_type,
        current_phase: currentPhase,
        current_cycle: cycleRecord.cycle_number,
        total_members: equbRecord.pool_capacity,
        pool_capacity: tierConfig.pool_capacity,
        status: equbRecord.status,
        phase_progress: this.buildPhaseProgress(phaseHistory),
        next_phase: this.getNextPhase(currentPhase),
        estimated_phase_end: new Date(
          cycleRecord.end_date.getTime(),
        ),
        health_score: healthScore,
        issues,
      };
    } catch (error) {
      this.logger.error(
        `[ORCHESTRATOR] Error getting status | ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Transition equb to next phase in workflow
   * @param equbId - Equb ID
   * @returns Transition result
   */
  async transitionToNextPhase(equbId: string): Promise<WorkflowTransitionResult> {
    this.logger.log(`[ORCHESTRATOR] Transitioning to next phase | Equb: ${equbId}`);

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

      // Get current cycle
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles 
         WHERE equb_id = $1 
         ORDER BY cycle_number DESC 
         LIMIT 1`,
        [equbId],
      );

      const cycleRecord = cycle[0];
      const currentPhase = this.determineCurrentPhase(equbRecord, cycleRecord);
      const nextPhase = this.getNextPhase(currentPhase);

      if (!nextPhase) {
        throw new ConflictException('Equb has reached final phase');
      }

      const transitionTime = new Date();

      // Execute phase transition
      let result: any;
      try {
        switch (nextPhase) {
          case EqubPhase.PHASE_1_ENROLLMENT:
            // Typically not transitioned to (starting phase)
            result = { success: true, message: 'Already in enrollment phase' };
            break;

          case EqubPhase.PHASE_2_COLLECTION:
            // Transition when pool is locked
            result = await this.transitionToCollection(equbRecord, cycleRecord);
            break;

          case EqubPhase.PHASE_3_RECONCILIATION:
            // Reconcile collections
            result = await this.phase3Service.generateReconciliationReport(cycleRecord.id);
            break;

          case EqubPhase.PHASE_4_WINNER_ALLOCATION:
            // Allocate winner
            result = await this.phase4Service.allocateWinnerByLottery(cycleRecord.id);
            break;

          case EqubPhase.PHASE_6_CYCLE_COMPLETION:
            // Complete cycle
            result = await this.phase6Service.completeCycle(cycleRecord.id);
            break;

          default:
            throw new BadRequestException(`Unknown phase: ${nextPhase}`);
        }
      } catch (phaseError) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`[ORCHESTRATOR] Phase transition failed | ${phaseError.message}`);

        return {
          equb_id: equbId,
          from_phase: currentPhase,
          to_phase: nextPhase,
          transition_time: transitionTime,
          status: 'FAILED',
          message: `Phase transition failed: ${phaseError.message}`,
        };
      }

      // Update equb phase and status
      await queryRunner.manager.query(
        `UPDATE equbs 
         SET current_phase = $1, phase_updated_at = $2, updated_at = $3 
         WHERE id = $4`,
        [nextPhase, transitionTime, transitionTime, equbId],
      );

      // Log transition
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PHASE_TRANSITION',
          'SYSTEM',
          JSON.stringify({
            equb_id: equbId,
            from_phase: currentPhase,
            to_phase: nextPhase,
            cycle_id: cycleRecord.id,
          }),
          transitionTime,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[ORCHESTRATOR] ✓ Transitioned | ${currentPhase} → ${nextPhase}`,
      );

      return {
        equb_id: equbId,
        from_phase: currentPhase,
        to_phase: nextPhase,
        transition_time: transitionTime,
        status: 'SUCCESS',
        message: `Successfully transitioned from ${currentPhase} to ${nextPhase}`,
        details: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[ORCHESTRATOR] Error transitioning | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Run full lifecycle automation for all active equbs
   * Scheduled daily to coordinate phase transitions
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async orchestrateAllEqubs(): Promise<void> {
    this.logger.log('[ORCHESTRATOR] Running daily orchestration task');

    try {
      // Get all active equbs
      const activeEqubs = await this.dataSource.manager.query(
        `SELECT id FROM equbs WHERE status IN ('POOL_LOCKED', 'ACTIVE', 'ROTATION_READY')`,
      );

      this.logger.log(`[ORCHESTRATOR] Processing ${activeEqubs.length} active equbs`);

      for (const equb of activeEqubs) {
        try {
          // Check if phase transition is needed
          const status = await this.getLifecycleStatus(equb.id);

          // Attempt automatic transition if conditions are met
          if (this.shouldAutoTransition(status)) {
            await this.transitionToNextPhase(equb.id);
          }

          // Check for critical issues
          if (status.issues.length > 0) {
            this.logger.warn(
              `[ORCHESTRATOR] Issues found in equb ${equb.id}: ${status.issues.join(', ')}`,
            );
          }
        } catch (equbError) {
          this.logger.error(
            `[ORCHESTRATOR] Error processing equb ${equb.id}: ${equbError.message}`,
          );
        }
      }

      this.logger.log('[ORCHESTRATOR] Daily orchestration completed');
    } catch (error) {
      this.logger.error(
        `[ORCHESTRATOR] Orchestration error | ${error.message}`,
      );
    }
  }

  /**
   * Get lifecycle report for all equbs
   * @returns Summary report
   */
  async getOrchestratedReport(): Promise<any> {
    this.logger.log('[ORCHESTRATOR] Generating orchestrated report');

    try {
      const equbs = await this.dataSource.manager.query(
        `SELECT id, name, tier_type, status FROM equbs WHERE status != 'COMPLETED'`,
      );

      const report = {
        total_active_equbs: equbs.length,
        equbs_by_status: {},
        equbs_by_tier: {},
        critical_issues: [],
        phase_distribution: {},
      };

      for (const equb of equbs) {
        // Count by status
        report.equbs_by_status[equb.status] =
          (report.equbs_by_status[equb.status] || 0) + 1;

        // Count by tier
        report.equbs_by_tier[equb.tier_type] =
          (report.equbs_by_tier[equb.tier_type] || 0) + 1;

        // Get lifecycle status
        try {
          const status = await this.getLifecycleStatus(equb.id);

          report.phase_distribution[status.current_phase] =
            (report.phase_distribution[status.current_phase] || 0) + 1;

          if (status.health_score < 50) {
            report.critical_issues.push({
              equb_id: equb.id,
              equb_name: equb.name,
              health_score: status.health_score,
              issues: status.issues,
            });
          }
        } catch (err) {
          this.logger.warn(
            `[ORCHESTRATOR] Could not get status for equb ${equb.id}`,
          );
        }
      }

      return report;
    } catch (error) {
      this.logger.error(
        `[ORCHESTRATOR] Error generating report | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to generate report: ${error.message}`,
      );
    }
  }

  /**
   * PRIVATE: Determine current phase
   */
  private determineCurrentPhase(
    equbRecord: any,
    cycleRecord: any,
  ): EqubPhase {
    if (equbRecord.status === 'REGISTRATION_OPEN') {
      return EqubPhase.PHASE_1_ENROLLMENT;
    }

    if (cycleRecord?.status === 'PENDING') {
      return EqubPhase.PHASE_2_COLLECTION;
    }

    if (cycleRecord?.status === 'RECONCILIATION') {
      return EqubPhase.PHASE_3_RECONCILIATION;
    }

    if (cycleRecord?.status === 'WINNER_SELECTION') {
      return EqubPhase.PHASE_4_WINNER_ALLOCATION;
    }

    if (cycleRecord?.status === 'PAYOUT_PENDING') {
      return EqubPhase.PHASE_5_PAYOUT_VERIFICATION;
    }

    return EqubPhase.PHASE_6_CYCLE_COMPLETION;
  }

  /**
   * PRIVATE: Get next phase
   */
  private getNextPhase(currentPhase: EqubPhase): EqubPhase | null {
    const phaseSequence = [
      EqubPhase.PHASE_1_ENROLLMENT,
      EqubPhase.PHASE_2_COLLECTION,
      EqubPhase.PHASE_3_RECONCILIATION,
      EqubPhase.PHASE_4_WINNER_ALLOCATION,
      EqubPhase.PHASE_5_PAYOUT_VERIFICATION,
      EqubPhase.PHASE_6_CYCLE_COMPLETION,
    ];

    const currentIndex = phaseSequence.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex === phaseSequence.length - 1) {
      return null;
    }

    return phaseSequence[currentIndex + 1];
  }

  /**
   * PRIVATE: Calculate health score
   */
  private async calculateHealthScore(
    equbId: string,
    cycleId: string,
  ): Promise<number> {
    try {
      const stats = await this.dataSource.manager.query(
        `SELECT 
           COUNT(em.id) as total_members,
           COUNT(CASE WHEN p.status = 'PAID' THEN 1 END) as paid_members,
           COUNT(CASE WHEN dr.status = 'DEFAULTED' THEN 1 END) as defaulted_members
         FROM equb_members em
         LEFT JOIN payments p ON em.member_id = p.member_id AND p.cycle_id = $1
         LEFT JOIN default_records dr ON em.member_id = dr.member_id AND dr.cycle_id = $1
         WHERE em.equb_id = $2`,
        [cycleId, equbId],
      );

      const totalMembers = stats[0].total_members;
      const paidMembers = stats[0].paid_members;
      const defaultedMembers = stats[0].defaulted_members;

      if (totalMembers === 0) return 50;

      const paymentRate = (paidMembers / totalMembers) * 100;
      const defaultRate = (defaultedMembers / totalMembers) * 100;

      let score = 100;
      score -= defaultRate * 2; // Each default reduces score by 2 points
      score -= (100 - paymentRate) * 0.5; // Each unpaid member reduces score by 0.5 points

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      this.logger.warn(`[ORCHESTRATOR] Could not calculate health score: ${error.message}`);
      return 50;
    }
  }

  /**
   * PRIVATE: Identify issues
   */
  private async identifyIssues(equbId: string, cycleId: string): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check for high default rate
      const defaultStats = await this.dataSource.manager.query(
        `SELECT COUNT(*) as defaults FROM default_records 
         WHERE cycle_id = $1`,
        [cycleId],
      );

      if (defaultStats[0].defaults > 2) {
        issues.push(`High default rate (${defaultStats[0].defaults} defaults)`);
      }

      // Check for low collection rate
      const collectionStats = await this.dataSource.manager.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid
         FROM payments WHERE cycle_id = $1`,
        [cycleId],
      );

      const collectionRate =
        (collectionStats[0].paid / collectionStats[0].total) * 100;
      if (collectionRate < 70) {
        issues.push(`Low collection rate (${collectionRate.toFixed(1)}%)`);
      }
    } catch (error) {
      this.logger.warn(`[ORCHESTRATOR] Error identifying issues: ${error.message}`);
    }

    return issues;
  }

  /**
   * PRIVATE: Build phase progress
   */
  private buildPhaseProgress(phaseHistory: any[]): any {
    const progress: any = {};

    for (const phase of Object.values(EqubPhase)) {
      progress[phase] = {
        completed: phaseHistory.some((h: any) => h.action.includes(phase)),
        last_executed: phaseHistory.find((h: any) =>
          h.action.includes(phase),
        )?.created_at || null,
      };
    }

    return progress;
  }

  /**
   * PRIVATE: Should auto-transition
   */
  private shouldAutoTransition(status: EqubLifecycleStatus): boolean {
    // Transition if in collection phase and cycle duration elapsed
    if (status.current_phase === EqubPhase.PHASE_2_COLLECTION) {
      const now = new Date();
      return now.getTime() > status.estimated_phase_end.getTime();
    }

    // Transition if reconciliation is complete
    if (status.current_phase === EqubPhase.PHASE_3_RECONCILIATION) {
      return status.health_score > 40;
    }

    // Transition if winner allocated
    if (status.current_phase === EqubPhase.PHASE_4_WINNER_ALLOCATION) {
      return true;
    }

    return false;
  }

  /**
   * PRIVATE: Transition to collection
   */
  private async transitionToCollection(
    equbRecord: any,
    cycleRecord: any,
  ): Promise<any> {
    return {
      message: 'Transitioned to collection phase',
      cycle_id: cycleRecord.id,
      status: 'ACTIVE',
    };
  }
}
