/**
 * Phase 4: Winner Allocation Engine
 * Allocates winners using Standard Lottery or Prime Option bidding
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
import { randomBytes } from 'crypto';

export interface WinnerAllocationResult {
  winner_id: string;
  winner_name: string;
  cycle_id: string;
  equb_id: string;
  allocation_method: 'STANDARD_LOTTERY' | 'PRIME_OPTION';
  gross_pot: number;
  platform_fee: number;
  net_payout: number;
  allocated_at: Date;
  message: string;
}

@Injectable()
export class Phase4WinnerEngineService {
  private readonly logger = new Logger(Phase4WinnerEngineService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Allocate winner for a cycle using standard lottery
   * @param cycleId - Cycle ID
   * @returns Winner allocation result
   */
  async allocateWinnerByLottery(cycleId: string): Promise<WinnerAllocationResult> {
    this.logger.log(`[PHASE-4] Allocating winner by lottery | Cycle: ${cycleId}`);

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

      // Get eligible members (haven't won yet, paid contribution)
      const eligibleMembers = await queryRunner.manager.query(
        `SELECT em.member_id, em.member_name, em.phone, em.email
         FROM equb_members em
         JOIN member_eligibility_status mes ON em.member_id = mes.member_id
         WHERE em.equb_id = $1 AND em.status = 'ACTIVE'
         AND mes.cycle_id = $2
         AND mes.have_paid_contribution = true
         AND mes.is_past_winner = false
         ORDER BY em.joined_at ASC`,
        [cycleRecord.equb_id, cycleId],
      );

      if (!eligibleMembers || eligibleMembers.length === 0) {
        throw new BadRequestException(
          `No eligible members found for lottery`,
        );
      }

      // Random selection using secure PRNG
      const selectedIndex =
        parseInt(randomBytes(4).toString('hex'), 16) % eligibleMembers.length;
      const selectedWinner = eligibleMembers[selectedIndex];

      // Get equb for fee calculation
      const equb = await queryRunner.manager.query(
        `SELECT * FROM equbs WHERE id = $1`,
        [cycleRecord.equb_id],
      );

      const platformFeePercentage = 3.5; // Default to 3.5%
      const platformFee = (cycleRecord.total_collected * platformFeePercentage) / 100;
      const netPayout = cycleRecord.total_collected - platformFee;

      // Create winner selection record
      const winnerSelectionId = this.generateId('WS');
      const allocatedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO winner_selections 
         (id, cycle_id, member_id, selection_method, gross_pot, platform_fee, 
          net_payout, allocated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          winnerSelectionId,
          cycleId,
          selectedWinner.member_id,
          'STANDARD_LOTTERY',
          cycleRecord.total_collected,
          platformFee,
          netPayout,
          allocatedAt,
          allocatedAt,
          allocatedAt,
        ],
      );

      // Mark winner as past winner
      await queryRunner.manager.query(
        `UPDATE member_eligibility_status 
         SET is_past_winner = true, updated_at = $1 
         WHERE cycle_id = $2 AND member_id = $3`,
        [allocatedAt, cycleId, selectedWinner.member_id],
      );

      // Create payout record
      const payoutId = this.generateId('PO');
      await queryRunner.manager.query(
        `INSERT INTO payout_history 
         (id, cycle_id, member_id, gross_amount, platform_fee, net_amount, 
          status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          payoutId,
          cycleId,
          selectedWinner.member_id,
          cycleRecord.total_collected,
          platformFee,
          netPayout,
          'PENDING_VERIFICATION',
          allocatedAt,
          allocatedAt,
        ],
      );

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'WINNER_SELECTED_LOTTERY',
          'SYSTEM',
          JSON.stringify({
            winner_id: selectedWinner.member_id,
            cycle_id: cycleId,
            eligible_members: eligibleMembers.length,
            gross_pot: cycleRecord.total_collected,
            net_payout: netPayout,
          }),
          allocatedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-4] ✓ Winner selected | ID: ${selectedWinner.member_id}, Net: ${netPayout} ETB`,
      );

      return {
        winner_id: selectedWinner.member_id,
        winner_name: selectedWinner.member_name,
        cycle_id: cycleId,
        equb_id: cycleRecord.equb_id,
        allocation_method: 'STANDARD_LOTTERY',
        gross_pot: cycleRecord.total_collected,
        platform_fee: platformFee,
        net_payout: netPayout,
        allocated_at: allocatedAt,
        message: `Winner selected! ${selectedWinner.member_name} wins ${netPayout} ETB (net of fees)`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-4] Error allocating winner | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Allocate winner using Prime Option (bidding)
   * @param cycleId - Cycle ID
   * @param bidAmount - Bid amount or percentage
   * @returns Winner allocation result
   */
  async allocateWinnerByPrimeOption(
    cycleId: string,
    bidAmount?: number,
  ): Promise<WinnerAllocationResult> {
    this.logger.log(
      `[PHASE-4] Allocating winner by Prime Option | Cycle: ${cycleId}`,
    );

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

      // Get Prime Option bids, ordered by highest bid
      const primeBids = await queryRunner.manager.query(
        `SELECT por.*, em.member_name, em.phone, em.email
         FROM prime_option_requests por
         JOIN equb_members em ON por.member_id = em.member_id
         WHERE por.cycle_id = $1 AND por.status = 'ACTIVE'
         ORDER BY por.bid_amount DESC, por.submitted_at ASC
         LIMIT 1`,
        [cycleId],
      );

      if (!primeBids || primeBids.length === 0) {
        throw new BadRequestException(
          `No Prime Option bids found for this cycle`,
        );
      }

      const selectedBid = primeBids[0];

      // Calculate fees
      const platformFeePercentage = 3.5;
      const platformFee = (cycleRecord.total_collected * platformFeePercentage) / 100;
      const netPayout = cycleRecord.total_collected - platformFee - selectedBid.bid_amount;

      // Create winner selection
      const winnerSelectionId = this.generateId('WS');
      const allocatedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO winner_selections 
         (id, cycle_id, member_id, selection_method, bid_reference_id, 
          gross_pot, platform_fee, bid_amount, net_payout, allocated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          winnerSelectionId,
          cycleId,
          selectedBid.member_id,
          'PRIME_OPTION',
          selectedBid.id,
          cycleRecord.total_collected,
          platformFee,
          selectedBid.bid_amount,
          netPayout,
          allocatedAt,
          allocatedAt,
          allocatedAt,
        ],
      );

      // Mark winner
      await queryRunner.manager.query(
        `UPDATE member_eligibility_status 
         SET is_past_winner = true, updated_at = $1 
         WHERE cycle_id = $2 AND member_id = $3`,
        [allocatedAt, cycleId, selectedBid.member_id],
      );

      // Create payout
      const payoutId = this.generateId('PO');
      await queryRunner.manager.query(
        `INSERT INTO payout_history 
         (id, cycle_id, member_id, gross_amount, platform_fee, bid_amount, net_amount, 
          status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          payoutId,
          cycleId,
          selectedBid.member_id,
          cycleRecord.total_collected,
          platformFee,
          selectedBid.bid_amount,
          netPayout,
          'PENDING_VERIFICATION',
          allocatedAt,
          allocatedAt,
        ],
      );

      // Mark other bids as rejected
      await queryRunner.manager.query(
        `UPDATE prime_option_requests 
         SET status = 'REJECTED' 
         WHERE cycle_id = $1 AND status = 'ACTIVE' AND member_id != $2`,
        [cycleId, selectedBid.member_id],
      );

      await queryRunner.manager.query(
        `UPDATE prime_option_requests 
         SET status = 'SELECTED' 
         WHERE id = $1`,
        [selectedBid.id],
      );

      // Log audit
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'WINNER_SELECTED_PRIME_OPTION',
          'SYSTEM',
          JSON.stringify({
            winner_id: selectedBid.member_id,
            cycle_id: cycleId,
            bid_amount: selectedBid.bid_amount,
            gross_pot: cycleRecord.total_collected,
            net_payout: netPayout,
          }),
          allocatedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PHASE-4] ✓ Prime winner selected | ID: ${selectedBid.member_id}, Net: ${netPayout} ETB`,
      );

      return {
        winner_id: selectedBid.member_id,
        winner_name: selectedBid.member_name,
        cycle_id: cycleId,
        equb_id: cycleRecord.equb_id,
        allocation_method: 'PRIME_OPTION',
        gross_pot: cycleRecord.total_collected,
        platform_fee: platformFee,
        net_payout: netPayout,
        allocated_at: allocatedAt,
        message: `Prime winner selected! ${selectedBid.member_name} wins ${netPayout} ETB (after bid of ${selectedBid.bid_amount} ETB)`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PHASE-4] Error in Prime Option | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get winner for a cycle
   * @param cycleId - Cycle ID
   * @returns Winner information
   */
  async getWinner(cycleId: string): Promise<any> {
    this.logger.log(`[PHASE-4] Getting winner | Cycle: ${cycleId}`);

    try {
      const winner = await this.dataSource.manager.query(
        `SELECT ws.*, em.member_name, em.phone, em.email
         FROM winner_selections ws
         JOIN equb_members em ON ws.member_id = em.member_id
         WHERE ws.cycle_id = $1`,
        [cycleId],
      );

      return winner.length > 0 ? winner[0] : null;
    } catch (error) {
      this.logger.error(
        `[PHASE-4] Error getting winner | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get winner: ${error.message}`,
      );
    }
  }

  /**
   * PRIVATE: Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(4).toString('hex').substring(0, 6);
    return `${prefix}-${timestamp}-${randomPart}`;
  }
}
