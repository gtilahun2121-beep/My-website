/**
 * Prime Option Service
 * Handles priority payout system where members can bid for early/priority wins
 * Implements bidding mechanism, priority queue, and fee redistribution
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

import {
  PrimeOptionRequest,
  PrimeOptionResult,
  BidValidationResult,
  PriorityQueueEntry,
  FeeDistributionResult,
  BidResolutionStrategy,
} from '../interfaces/prime-option.interface';

/**
 * Repository injection interface
 */
interface RepositoryCollection {
  primeOptionRequestRepository: any;
  payoutCycleRepository: any;
  memberEligibilityRepository: any;
  winnerSelectionRepository: any;
  payoutHistoryRepository: any;
  paymentReminderRepository: any;
  auditLogRepository: any;
}

@Injectable()
export class PrimeOptionService {
  private readonly logger = new Logger(PrimeOptionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repositories: RepositoryCollection,
  ) {}

  /**
   * Submit a Prime Option (bidding) request for early/priority payout
   * @param cycleId - Payout cycle ID
   * @param memberId - Member requesting prime option
   * @param bidAmount - Amount willing to bid (percentage or fixed)
   * @param bidType - 'PERCENTAGE' (of pot) or 'FIXED' (absolute amount)
   * @returns PrimeOptionResult with bid confirmation and queue position
   */
  async submitBidRequest(
    cycleId: string,
    memberId: string,
    bidAmount: number,
    bidType: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE',
  ): Promise<PrimeOptionResult> {
    this.logger.log(
      `[PRIME] Submitting bid request | Cycle: ${cycleId}, Member: ${memberId}, Bid: ${bidAmount}${bidType === 'PERCENTAGE' ? '%' : ' ETB'}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate cycle exists and is in appropriate status
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1`,
        [cycleId],
      );
      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Payout cycle ${cycleId} not found`);
      }

      if (!['OPEN', 'BIDDING'].includes(cycle[0].status)) {
        throw new ConflictException(
          `Cycle is in ${cycle[0].status} status. Prime Option bids only accepted in OPEN or BIDDING status`,
        );
      }

      // 2. Verify member is eligible and active in this cycle
      const memberEligibility = await queryRunner.manager.query(
        `SELECT * FROM member_eligibility_status 
         WHERE cycle_id = $1 AND member_id = $2`,
        [cycleId, memberId],
      );
      if (!memberEligibility || memberEligibility.length === 0) {
        throw new BadRequestException(
          `Member ${memberId} is not active in cycle ${cycleId}`,
        );
      }

      // 3. Check member has paid contributions for this cycle
      if (!memberEligibility[0].have_paid_contribution) {
        throw new ConflictException(
          `Member must pay contributions before submitting Prime Option bid`,
        );
      }

      // 4. Verify member hasn't already won in this cycle
      if (memberEligibility[0].is_past_winner) {
        throw new ConflictException(
          `Member has already won in this cycle and cannot bid again`,
        );
      }

      // 5. Check for existing bid from this member in this cycle
      const existingBid = await queryRunner.manager.query(
        `SELECT * FROM prime_option_requests 
         WHERE cycle_id = $1 AND member_id = $2 AND status = 'ACTIVE'`,
        [cycleId, memberId],
      );
      if (existingBid && existingBid.length > 0) {
        throw new ConflictException(
          `Member already has an active bid for this cycle. Cancel existing bid to submit new one.`,
        );
      }

      // 6. Validate bid amount
      if (bidAmount <= 0) {
        throw new BadRequestException(`Bid amount must be greater than 0`);
      }

      if (bidType === 'PERCENTAGE' && bidAmount > 100) {
        throw new BadRequestException(
          `Percentage bid cannot exceed 100%`,
        );
      }

      // Calculate actual bid amount
      const potAmount = cycle[0].total_collected;
      const actualBidAmount =
        bidType === 'PERCENTAGE'
          ? (potAmount * bidAmount) / 100
          : bidAmount;

      if (actualBidAmount > potAmount) {
        throw new BadRequestException(
          `Bid amount (${actualBidAmount} ETB) cannot exceed pot (${potAmount} ETB)`,
        );
      }

      // 7. Create Prime Option request
      const primeOptionId = this.generateId('PO');
      const submittedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO prime_option_requests 
         (id, cycle_id, member_id, bid_amount, bid_type, actual_bid_amount, 
          status, submitted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          primeOptionId,
          cycleId,
          memberId,
          bidAmount,
          bidType,
          actualBidAmount,
          'ACTIVE',
          submittedAt,
          submittedAt,
          submittedAt,
        ],
      );

      // 8. Update cycle status to BIDDING if needed
      if (cycle[0].status === 'OPEN') {
        await queryRunner.manager.query(
          `UPDATE payout_cycles SET status = 'BIDDING', updated_at = $1 WHERE id = $2`,
          [new Date(), cycleId],
        );
      }

      // 9. Calculate current queue position
      const queuePosition = await queryRunner.manager.query(
        `SELECT COUNT(*) as count FROM prime_option_requests 
         WHERE cycle_id = $1 AND status = 'ACTIVE' AND submitted_at < $2`,
        [cycleId, submittedAt],
      );

      // 10. Log audit entry
      const auditEntry = {
        action: 'PRIME_OPTION_SUBMITTED',
        actor_id: memberId,
        cycle_id: cycleId,
        details: {
          bid_amount: bidAmount,
          bid_type: bidType,
          actual_bid_amount: actualBidAmount,
          queue_position: queuePosition[0].count + 1,
        },
        timestamp: submittedAt,
      };
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          auditEntry.action,
          auditEntry.actor_id,
          JSON.stringify(auditEntry.details),
          auditEntry.timestamp,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PRIME] Bid accepted | ID: ${primeOptionId}, Queue Position: ${queuePosition[0].count + 1}`,
      );

      return {
        success: true,
        primeOptionId,
        cycleId,
        memberId,
        bidAmount,
        bidType,
        actualBidAmount,
        potAmount,
        queuePosition: queuePosition[0].count + 1,
        status: 'ACTIVE',
        submittedAt,
        message: `Prime Option bid submitted successfully. Queue position: ${queuePosition[0].count + 1}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PRIME] Error submitting bid | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Select winner from Prime Option bids using priority resolution
   * @param cycleId - Payout cycle ID
   * @param strategy - Resolution strategy ('HIGHEST_BID' | 'FIRST_SUBMITTED' | 'CUSTOM')
   * @returns PrimeOptionResult with selected winner
   */
  async selectPrimeWinner(
    cycleId: string,
    strategy: BidResolutionStrategy = 'HIGHEST_BID',
  ): Promise<PrimeOptionResult> {
    this.logger.log(
      `[PRIME] Selecting winner using ${strategy} strategy | Cycle: ${cycleId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify cycle exists
      const cycle = await queryRunner.manager.query(
        `SELECT * FROM payout_cycles WHERE id = $1`,
        [cycleId],
      );
      if (!cycle || cycle.length === 0) {
        throw new NotFoundException(`Payout cycle ${cycleId} not found`);
      }

      // 2. Check cycle doesn't already have a winner
      if (cycle[0].selected_winner_id) {
        throw new ConflictException(
          `Cycle already has a selected winner: ${cycle[0].selected_winner_id}`,
        );
      }

      // 3. Get all active Prime Option bids
      const activeBids = await queryRunner.manager.query(
        `SELECT por.*, e.first_name, e.last_name, e.phone, e.email 
         FROM prime_option_requests por
         JOIN members e ON por.member_id = e.id
         WHERE por.cycle_id = $1 AND por.status = 'ACTIVE'
         ORDER BY ${this.getOrderByClause(strategy)}`,
        [cycleId],
      );

      if (!activeBids || activeBids.length === 0) {
        throw new BadRequestException(
          `No active Prime Option bids found for cycle ${cycleId}`,
        );
      }

      // 4. Select winner based on strategy
      const selectedBid = activeBids[0];
      const winnerId = selectedBid.member_id;

      // 5. Create winner selection record
      const winnerSelectionId = this.generateId('WS');
      const selectedAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO winner_selections 
         (id, cycle_id, member_id, selection_method, bid_reference_id, 
          pot_amount, selected_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          winnerSelectionId,
          cycleId,
          winnerId,
          'PRIME_OPTION',
          selectedBid.id,
          cycle[0].total_collected,
          selectedAt,
          selectedAt,
          selectedAt,
        ],
      );

      // 6. Update cycle with selected winner
      await queryRunner.manager.query(
        `UPDATE payout_cycles 
         SET selected_winner_id = $1, status = 'PRIME_SELECTED', updated_at = $2 
         WHERE id = $3`,
        [winnerId, selectedAt, cycleId],
      );

      // 7. Mark all other bids as REJECTED
      await queryRunner.manager.query(
        `UPDATE prime_option_requests 
         SET status = 'REJECTED', updated_at = $1 
         WHERE cycle_id = $2 AND member_id != $3 AND status = 'ACTIVE'`,
        [selectedAt, cycleId, winnerId],
      );

      // 8. Mark winning bid as SELECTED
      await queryRunner.manager.query(
        `UPDATE prime_option_requests 
         SET status = 'SELECTED', updated_at = $1 
         WHERE id = $2`,
        [selectedAt, selectedBid.id],
      );

      // 9. Mark member as past winner
      await queryRunner.manager.query(
        `UPDATE member_eligibility_status 
         SET is_past_winner = true, updated_at = $1 
         WHERE cycle_id = $2 AND member_id = $3`,
        [selectedAt, cycleId, winnerId],
      );

      // 10. Create payout history record (PENDING)
      const payoutHistoryId = this.generateId('PH');
      await queryRunner.manager.query(
        `INSERT INTO payout_history 
         (id, cycle_id, member_id, amount, status, disbursement_method, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          payoutHistoryId,
          cycleId,
          winnerId,
          cycle[0].total_collected,
          'PENDING',
          'DIRECT_TRANSFER',
          selectedAt,
          selectedAt,
        ],
      );

      // 11. Create payment reminder
      const paymentReminderId = this.generateId('PR');
      await queryRunner.manager.query(
        `INSERT INTO payment_reminders 
         (id, cycle_id, member_id, payout_history_id, reminder_type, 
          scheduled_for, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          paymentReminderId,
          cycleId,
          winnerId,
          payoutHistoryId,
          'PAYOUT_READY',
          selectedAt,
          selectedAt,
          selectedAt,
        ],
      );

      // 12. Handle fee redistribution if configured
      if (selectedBid.actual_bid_amount > 0) {
        await this.redistributeFeeToMembers(
          queryRunner,
          cycleId,
          selectedBid.actual_bid_amount,
        );
      }

      // 13. Log audit entry
      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PRIME_WINNER_SELECTED',
          'SYSTEM',
          JSON.stringify({
            strategy,
            winner_id: winnerId,
            bid_amount: selectedBid.actual_bid_amount,
            total_bids: activeBids.length,
          }),
          selectedAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[PRIME] Winner selected | ID: ${winnerId}, Strategy: ${strategy}, Bids: ${activeBids.length}`,
      );

      return {
        success: true,
        primeOptionId: selectedBid.id,
        cycleId,
        memberId: winnerId,
        winnerName: `${selectedBid.first_name} ${selectedBid.last_name}`,
        winnerPhone: selectedBid.phone,
        winnerEmail: selectedBid.email,
        bidAmount: selectedBid.bid_amount,
        actualBidAmount: selectedBid.actual_bid_amount,
        potAmount: cycle[0].total_collected,
        totalBidsReceived: activeBids.length,
        resolutionStrategy: strategy,
        selectedAt,
        status: 'SELECTED',
        message: `Prime winner selected successfully using ${strategy} strategy`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PRIME] Error selecting winner | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get active bids for a cycle with priority queue position
   * @param cycleId - Payout cycle ID
   * @returns Array of priority queue entries
   */
  async getActiveBidsQueue(cycleId: string): Promise<PriorityQueueEntry[]> {
    this.logger.log(`[PRIME] Fetching active bids queue | Cycle: ${cycleId}`);

    try {
      const bids = await this.repositories.primeOptionRequestRepository.query(
        `SELECT por.id, por.member_id, por.bid_amount, por.bid_type, 
                por.actual_bid_amount, por.submitted_at, por.status,
                m.first_name, m.last_name, m.phone,
                ROW_NUMBER() OVER (ORDER BY por.submitted_at ASC) as queue_position
         FROM prime_option_requests por
         JOIN members m ON por.member_id = m.id
         WHERE por.cycle_id = $1 AND por.status = 'ACTIVE'
         ORDER BY por.submitted_at ASC`,
        [cycleId],
      );

      return bids.map((bid: any) => ({
        queuePosition: bid.queue_position,
        primeOptionId: bid.id,
        memberId: bid.member_id,
        memberName: `${bid.first_name} ${bid.last_name}`,
        memberPhone: bid.phone,
        bidAmount: bid.bid_amount,
        bidType: bid.bid_type,
        actualBidAmount: bid.actual_bid_amount,
        submittedAt: bid.submitted_at,
        status: bid.status,
      }));
    } catch (error) {
      this.logger.error(
        `[PRIME] Error fetching bids queue | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to fetch bids queue: ${error.message}`,
      );
    }
  }

  /**
   * Cancel a Prime Option bid
   * @param primeOptionId - Prime Option request ID
   * @returns Cancellation confirmation
   */
  async cancelBid(primeOptionId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`[PRIME] Cancelling bid | ID: ${primeOptionId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bid = await queryRunner.manager.query(
        `SELECT * FROM prime_option_requests WHERE id = $1`,
        [primeOptionId],
      );

      if (!bid || bid.length === 0) {
        throw new NotFoundException(`Prime Option bid ${primeOptionId} not found`);
      }

      if (bid[0].status !== 'ACTIVE') {
        throw new ConflictException(
          `Cannot cancel bid with status ${bid[0].status}. Only ACTIVE bids can be cancelled.`,
        );
      }

      const cancelledAt = new Date();
      await queryRunner.manager.query(
        `UPDATE prime_option_requests 
         SET status = 'CANCELLED', updated_at = $1 
         WHERE id = $2`,
        [cancelledAt, primeOptionId],
      );

      await queryRunner.manager.query(
        `INSERT INTO audit_logs (action, actor_id, details, created_at) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PRIME_BID_CANCELLED',
          bid[0].member_id,
          JSON.stringify({ bid_id: primeOptionId }),
          cancelledAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(`[PRIME] Bid cancelled | ID: ${primeOptionId}`);

      return {
        success: true,
        message: `Prime Option bid ${primeOptionId} cancelled successfully`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[PRIME] Error cancelling bid | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate a bid before submission
   * @param cycleId - Payout cycle ID
   * @param memberId - Member ID
   * @param bidAmount - Bid amount to validate
   * @returns Validation result with any errors
   */
  async validateBid(
    cycleId: string,
    memberId: string,
    bidAmount: number,
  ): Promise<BidValidationResult> {
    this.logger.log(
      `[PRIME] Validating bid | Cycle: ${cycleId}, Member: ${memberId}, Amount: ${bidAmount}`,
    );

    const errors: string[] = [];
    let isValid = true;

    try {
      // Check cycle exists
      const cycle = await this.repositories.payoutCycleRepository.findOne(cycleId);
      if (!cycle) {
        errors.push(`Payout cycle ${cycleId} not found`);
        isValid = false;
      } else {
        // Check cycle status
        if (!['OPEN', 'BIDDING'].includes(cycle.status)) {
          errors.push(
            `Cycle is in ${cycle.status} status. Prime Option only accepted in OPEN or BIDDING`,
          );
          isValid = false;
        }

        // Check bid amount
        if (bidAmount <= 0) {
          errors.push(`Bid amount must be greater than 0`);
          isValid = false;
        }

        if (bidAmount > 100) {
          errors.push(`Bid percentage cannot exceed 100%`);
          isValid = false;
        }

        if ((bidAmount / 100) * cycle.total_collected > cycle.total_collected) {
          errors.push(
            `Bid amount exceeds pot total (${cycle.total_collected} ETB)`,
          );
          isValid = false;
        }
      }

      // Check member eligibility
      const eligibility = await this.repositories.memberEligibilityRepository.findOne({
        cycle_id: cycleId,
        member_id: memberId,
      });
      if (!eligibility) {
        errors.push(`Member is not active in this cycle`);
        isValid = false;
      } else {
        if (!eligibility.have_paid_contribution) {
          errors.push(`Member must pay contributions first`);
          isValid = false;
        }
        if (eligibility.is_past_winner) {
          errors.push(`Member already won in this cycle`);
          isValid = false;
        }
      }

      // Check for existing active bid
      const existingBid = await this.repositories.primeOptionRequestRepository.findOne({
        cycle_id: cycleId,
        member_id: memberId,
        status: 'ACTIVE',
      });
      if (existingBid) {
        errors.push(`Member already has an active bid for this cycle`);
        isValid = false;
      }

      return {
        isValid,
        errors,
        message: isValid ? 'Bid validation passed' : `Bid validation failed: ${errors.join('; ')}`,
      };
    } catch (error) {
      this.logger.error(
        `[PRIME] Error validating bid | ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to validate bid: ${error.message}`,
      );
    }
  }

  /**
   * PRIVATE: Redistribute fee to other members
   */
  private async redistributeFeeToMembers(
    queryRunner: any,
    cycleId: string,
    feeAmount: number,
  ): Promise<void> {
    this.logger.log(
      `[PRIME] Redistributing fee | Cycle: ${cycleId}, Amount: ${feeAmount}`,
    );

    try {
      // Get eligible members (excluding winner)
      const members = await queryRunner.manager.query(
        `SELECT member_id FROM member_eligibility_status 
         WHERE cycle_id = $1 AND is_past_winner = false`,
        [cycleId],
      );

      if (members.length === 0) {
        this.logger.warn(
          `[PRIME] No eligible members for fee redistribution in cycle ${cycleId}`,
        );
        return;
      }

      const perMemberShare = feeAmount / members.length;

      // Create redistribution records for each member
      for (const member of members) {
        const redistributionId = this.generateId('RD');
        await queryRunner.manager.query(
          `INSERT INTO fee_redistribution_records 
           (id, cycle_id, member_id, amount, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            redistributionId,
            cycleId,
            member.member_id,
            perMemberShare,
            new Date(),
          ],
        );
      }

      this.logger.log(
        `[PRIME] Fee redistributed | Per member: ${perMemberShare} ETB to ${members.length} members`,
      );
    } catch (error) {
      this.logger.warn(
        `[PRIME] Error redistributing fee (non-critical) | ${error.message}`,
      );
      // Non-critical operation, don't throw
    }
  }

  /**
   * PRIVATE: Get ORDER BY clause based on strategy
   */
  private getOrderByClause(strategy: BidResolutionStrategy): string {
    switch (strategy) {
      case 'HIGHEST_BID':
        return 'por.actual_bid_amount DESC, por.submitted_at ASC';
      case 'FIRST_SUBMITTED':
        return 'por.submitted_at ASC';
      case 'CUSTOM':
        return 'por.custom_priority ASC, por.submitted_at ASC';
      default:
        return 'por.actual_bid_amount DESC, por.submitted_at ASC';
    }
  }

  /**
   * PRIVATE: Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(6).toString('hex');
    return `${prefix}-${timestamp}-${randomPart}`;
  }
}
