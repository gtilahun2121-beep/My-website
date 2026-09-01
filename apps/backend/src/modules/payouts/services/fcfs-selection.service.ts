/**
 * FCFS Selection Service
 * Handles First-Come-First-Served winner selection based on join timestamps
 * Members are selected as winners in the order they joined the equb
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
  FCFSResult,
  SequentialWinner,
  FCFSValidation,
} from '../interfaces/fcfs.interface';

/**
 * Repository injection interface
 */
interface RepositoryCollection {
  payoutCycleRepository: any;
  memberEligibilityRepository: any;
  winnerSelectionRepository: any;
  payoutHistoryRepository: any;
  paymentReminderRepository: any;
  auditLogRepository: any;
  equbMembersRepository: any;
}

@Injectable()
export class FCFSSelectionService {
  private readonly logger = new Logger(FCFSSelectionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repositories: RepositoryCollection,
  ) {}

  /**
   * Select next winner in FCFS order for a cycle
   * @param cycleId - Payout cycle ID
   * @param equbId - Equb ID
   * @returns FCFSResult with selected winner
   */
  async selectNextFCFSWinner(
    equbId: string,
    cycleId: string,
  ): Promise<FCFSResult> {
    this.logger.log(
      `[FCFS] Selecting next FCFS winner | Equb: ${equbId}, Cycle: ${cycleId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify cycle exists
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1 AND equb_id = $2`,
        [cycleId, equbId],
      );
      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Payout cycle ${cycleId} not found`);
      }

      // 2. Verify cycle is in correct status
      if (!['OPEN', 'FCFS_READY'].includes(cycle[0].status)) {
        throw new ConflictException(
          `Cycle is in ${cycle[0].status} status. Cannot select FCFS winner.`,
        );
      }

      // 3. Check cycle doesn't already have a winner
      if (cycle[0].selected_winner_id) {
        throw new ConflictException(
          `Cycle already has a selected winner: ${cycle[0].selected_winner_id}`,
        );
      }

      // 4. Get the equb to verify it uses FCFS model
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [equbId],
      );
      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb ${equbId} not found`);
      }

      if (equb[0].selection_model !== 'FCFS') {
        throw new ConflictException(
          `Equb uses ${equb[0].selection_model} model, not FCFS`,
        );
      }

      // 5. Get cycle round number to determine which member should win
      const cycleRound = cycle[0].round_number || 1;

      // 6. Get all members sorted by join date (ascending)
      const members = await queryRunner.manager.query(
        `SELECT em.id as member_id, m.first_name, m.last_name, m.phone, m.email, 
                em.joined_at, em.have_paid_contribution, em.is_past_winner,
                ROW_NUMBER() OVER (ORDER BY em.joined_at ASC) as join_order
         FROM equb_members em
         JOIN members m ON em.member_id = m.id
         WHERE em.equb_id = $1 AND em.status = 'ACTIVE'
         ORDER BY em.joined_at ASC`,
        [equbId],
      );

      if (!members || members.length === 0) {
        throw new BadRequestException(
          `No active members found in equb ${equbId}`,
        );
      }

      // 7. Determine winner based on round number
      // If cycleRound > total members, wrap around
      const winnerIndex = ((cycleRound - 1) % members.length);
      const selectedMember = members[winnerIndex];

      // 8. Verify selected member has paid contributions
      if (!selectedMember.have_paid_contribution) {
        throw new ConflictException(
          `Member ${selectedMember.member_id} (${selectedMember.join_order} in queue) has not paid contributions for this cycle`,
        );
      }

      // 9. Check if member already won in a previous cycle
      const previousWin = await queryRunner.manager.query(
        `SELECT * FROM member_eligibility_status 
         WHERE equb_id = $1 AND member_id = $2 AND is_past_winner = true`,
        [equbId, selectedMember.member_id],
      );

      if (previousWin && previousWin.length > 0 && cycle[0].allow_repeat_winners === false) {
        this.logger.warn(
          `[FCFS] Member already won previously. Checking policy...`,
        );
        // If equb doesn't allow repeat winners, skip to next member
        return this.selectNextAvailableFCFSMember(
          queryRunner,
          equbId,
          cycleId,
          members,
          winnerIndex,
        );
      }

      // 10. Create winner selection record
      const winnerSelectionId = this.generateId('WS');
      const selectedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO winner_selections 
         (id, cycle_id, member_id, selection_method, fcfs_join_order, 
          pot_amount, selected_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          winnerSelectionId,
          cycleId,
          selectedMember.member_id,
          'FCFS',
          selectedMember.join_order,
          cycle[0].total_collected,
          selectedAt,
          selectedAt,
          selectedAt,
        ],
      );

      // 11. Update cycle with selected winner
      await queryRunner.manager.query(
        `UPDATE payout_cycles 
         SET selected_winner_id = $1, status = 'FCFS_SELECTED', updated_at = $2 
         WHERE id = $3`,
        [selectedMember.member_id, selectedAt, cycleId],
      );

      // 12. Update member eligibility
      await queryRunner.manager.query(
        `UPDATE member_eligibility_status 
         SET is_past_winner = true, updated_at = $1 
         WHERE cycle_id = $2 AND member_id = $3`,
        [selectedAt, cycleId, selectedMember.member_id],
      );

      // 13. Create payout history record
      const payoutHistoryId = this.generateId('PH');
      await queryRunner.manager.query(
        `INSERT INTO payout_history 
         (id, cycle_id, member_id, amount, status, disbursement_method, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          payoutHistoryId,
          cycleId,
          selectedMember.member_id,
          cycle[0].total_collected,
          'PENDING',
          'DIRECT_TRANSFER',
          selectedAt,
          selectedAt,
        ],
      );

      // 14. Create payment reminder
      const paymentReminderId = this.generateId('PR');
      await queryRunner.manager.query(
        `INSERT INTO payment_reminders 
         (id, cycle_id, member_id, payout_history_id, reminder_type, 
          scheduled_for, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          paymentReminderId,
          cycleId,
          selectedMember.member_id,
          payoutHistoryId,
          'PAYOUT_READY',
          selectedAt,
          selectedAt,
          selectedAt,
        ],
      );

      // 15. Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'FCFS_WINNER_SELECTED',
          'SYSTEM',
          JSON.stringify({
            member_id: selectedMember.member_id,
            join_order: selectedMember.join_order,
            cycle_round: cycleRound,
            total_members: members.length,
          }),
          selectedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[FCFS] Winner selected | Member: ${selectedMember.member_id}, Order: ${selectedMember.join_order}/${members.length}`,
      );

      return {
        success: true,
        cycleId,
        equbId,
        winnerId: selectedMember.member_id,
        winnerName: `${selectedMember.first_name} ${selectedMember.last_name}`,
        winnerPhone: selectedMember.phone,
        winnerEmail: selectedMember.email,
        joinOrder: selectedMember.join_order,
        totalMembers: members.length,
        cycleRound,
        potAmount: cycle[0].total_collected,
        selectedAt,
        status: 'SELECTED',
        message: `Winner selected: Member #${selectedMember.join_order} (${selectedMember.first_name} ${selectedMember.last_name})`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[FCFS] Error selecting winner | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get FCFS queue for an equb (showing order and status)
   * @param equbId - Equb ID
   * @returns Array of sequential winners
   */
  async getFCFSQueue(equbId: string): Promise<SequentialWinner[]> {
    this.logger.log(`[FCFS] Fetching FCFS queue | Equb: ${equbId}`);

    try {
      const queue = await this.repositories.equbMembersRepository.query(
        `SELECT em.id as member_id, m.first_name, m.last_name, m.phone, 
                em.joined_at, em.have_paid_contribution, em.is_past_winner,
                ROW_NUMBER() OVER (ORDER BY em.joined_at ASC) as queue_position,
                DENSE_RANK() OVER (ORDER BY em.joined_at ASC) as assigned_cycle
         FROM equb_members em
         JOIN members m ON em.member_id = m.id
         WHERE em.equb_id = $1 AND em.status = 'ACTIVE'
         ORDER BY em.joined_at ASC`,
        [equbId],
      );

      return queue.map((member: any) => ({
        queuePosition: member.queue_position,
        assignedCycle: member.assigned_cycle,
        memberId: member.member_id,
        memberName: `${member.first_name} ${member.last_name}`,
        memberPhone: member.phone,
        joinedAt: member.joined_at,
        hasPaidContribution: member.have_paid_contribution,
        isPastWinner: member.is_past_winner,
        status: member.is_past_winner ? 'COMPLETED' : 'PENDING',
      }));
    } catch (error) {
      this.logger.error(
        `[FCFS] Error fetching queue | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to fetch FCFS queue: ${error.message}`,
      );
    }
  }

  /**
   * Validate FCFS conditions for a cycle
   * @param equbId - Equb ID
   * @param cycleId - Payout cycle ID
   * @returns Validation result
   */
  async validateFCFSConditions(
    equbId: string,
    cycleId: string,
  ): Promise<FCFSValidation> {
    this.logger.log(
      `[FCFS] Validating FCFS conditions | Equb: ${equbId}, Cycle: ${cycleId}`,
    );

    const errors: string[] = [];
    let isValid = true;

    try {
      // Check cycle exists
      const cycle = await this.repositories.payoutCycleRepository.findOne(cycleId);
      if (!cycle) {
        errors.push(`Cycle ${cycleId} not found`);
        isValid = false;
      } else {
        // Check cycle status
        if (!['OPEN', 'FCFS_READY'].includes(cycle.status)) {
          errors.push(`Cycle is in ${cycle.status} status`);
          isValid = false;
        }

        if (cycle.selected_winner_id) {
          errors.push(`Winner already selected for this cycle`);
          isValid = false;
        }
      }

      // Check equb uses FCFS model
      const equb = await this.repositories.equbMembersRepository.find({
        equb_id: equbId,
      });

      if (!equb || equb.length === 0) {
        errors.push(`No active members in equb`);
        isValid = false;
      }

      return {
        isValid,
        errors,
        message: isValid ? 'FCFS conditions valid' : `Validation failed: ${errors.join('; ')}`,
      };
    } catch (error) {
      this.logger.error(
        `[FCFS] Error validating conditions | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to validate FCFS conditions: ${error.message}`,
      );
    }
  }

  /**
   * PRIVATE: Select next available member if current member is ineligible
   */
  private async selectNextAvailableFCFSMember(
    queryRunner: any,
    equbId: string,
    cycleId: string,
    members: any[],
    startIndex: number,
  ): Promise<FCFSResult> {
    this.logger.log(
      `[FCFS] Searching for next available member from index ${startIndex}`,
    );

    for (let i = 0; i < members.length; i++) {
      const candidate = members[(startIndex + i) % members.length];

      // Skip if already won
      const previousWin = await queryRunner.manager.query(
        `SELECT * FROM member_eligibility_status 
         WHERE equb_id = $1 AND member_id = $2 AND is_past_winner = true`,
        [equbId, candidate.member_id],
      );

      if (previousWin && previousWin.length > 0) {
        continue;
      }

      // Skip if hasn't paid
      if (!candidate.have_paid_contribution) {
        continue;
      }

      // Found eligible member - select as winner
      return this.selectMemberAsWinner(queryRunner, equbId, cycleId, candidate);
    }

    throw new BadRequestException(
      `No eligible members found in FCFS order for this cycle`,
    );
  }

  /**
   * PRIVATE: Select a specific member as winner
   */
  private async selectMemberAsWinner(
    queryRunner: any,
    equbId: string,
    cycleId: string,
    member: any,
  ): Promise<FCFSResult> {
    const selectedAt = new Date();
    const winnerSelectionId = this.generateId('WS');

    // Get cycle info
    const cycle = await queryRunner.manager.query(
      `SELECT * FROM payout_cycles WHERE id = $1`,
      [cycleId],
    );

    // Create winner selection
    await queryRunner.manager.query(
      `INSERT INTO winner_selections 
       (id, cycle_id, member_id, selection_method, fcfs_join_order, 
        pot_amount, selected_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        winnerSelectionId,
        cycleId,
        member.member_id,
        'FCFS',
        member.join_order,
        cycle[0].total_collected,
        selectedAt,
        selectedAt,
        selectedAt,
      ],
    );

    // Update cycle
    await queryRunner.manager.query(
      `UPDATE payout_cycles 
       SET selected_winner_id = $1, status = 'FCFS_SELECTED', updated_at = $2 
       WHERE id = $3`,
      [member.member_id, selectedAt, cycleId],
    );

    // Update eligibility
    await queryRunner.manager.query(
      `UPDATE member_eligibility_status 
       SET is_past_winner = true, updated_at = $1 
       WHERE cycle_id = $2 AND member_id = $3`,
      [selectedAt, cycleId, member.member_id],
    );

    // Create payout history
    const payoutHistoryId = this.generateId('PH');
    await queryRunner.manager.query(
      `INSERT INTO payout_history 
       (id, cycle_id, member_id, amount, status, disbursement_method, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        payoutHistoryId,
        cycleId,
        member.member_id,
        cycle[0].total_collected,
        'PENDING',
        'DIRECT_TRANSFER',
        selectedAt,
        selectedAt,
      ],
    );

    // Create payment reminder
    const paymentReminderId = this.generateId('PR');
    await queryRunner.manager.query(
      `INSERT INTO payment_reminders 
       (id, cycle_id, member_id, payout_history_id, reminder_type, 
        scheduled_for, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        paymentReminderId,
        cycleId,
        member.member_id,
        payoutHistoryId,
        'PAYOUT_READY',
        selectedAt,
        selectedAt,
        selectedAt,
      ],
    );

    await queryRunner.commitTransaction();

    return {
      success: true,
      cycleId,
      equbId,
      winnerId: member.member_id,
      winnerName: `${member.first_name} ${member.last_name}`,
      winnerPhone: member.phone,
      winnerEmail: member.email,
      joinOrder: member.join_order,
      totalMembers: 0,
      cycleRound: 0,
      potAmount: cycle[0].total_collected,
      selectedAt,
      status: 'SELECTED',
      message: `Winner selected: ${member.first_name} ${member.last_name}`,
    };
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
