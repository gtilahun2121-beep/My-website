/**
 * FCFS (First-Come-First-Serve) Selection Service
 * Handles winner selection based on payment arrival order (who paid first)
 */

import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { getPool } from '../../../config/database.config';

export interface FCFSSelectionResult {
    success: boolean;
    winner_id?: string;
    winner_name?: string;
    cycle_id?: string;
    equb_id?: string;
    selection_method: 'fcfs';
    payment_order?: number;
    selected_at?: Date;
    error?: string;
    message: string;
}

@Injectable()
export class FCFSSelectionService {
    private readonly logger = new Logger(FCFSSelectionService.name);

    constructor() {}

    /**
     * Select winner for FCFS (First-Come-First-Serve) equb
     * Winner is the first member who paid for this round
     *
     * Process:
     * 1. Verify cycle exists and is drawable
     * 2. Get first member who paid (by payment arrival order)
     * 3. Ensure member exists and is eligible
     * 4. Create payout record atomically
     * 5. Advance to next round
     * 6. Notify winner
     *
     * @param equbId - The equb identifier
     * @param roundNumber - The round number
     * @returns FCFS selection result
     * @throws BadRequestException if no one paid or round already has winner
     */
    async selectWinnerForRound(equbId: string, roundNumber: number): Promise<FCFSSelectionResult> {
        this.logger.log(
            `Starting FCFS selection for equb: ${equbId}, round: ${roundNumber}`,
        );

        const sql = getPool();

        try {
            // Step 1: Verify round exists and hasn't been drawn yet
            const [roundData] = await sql`
                SELECT eg.id, eg.status, eg.total_rounds, eg.current_round, eg.contribution_amount,
                       COUNT(p.id) FILTER (WHERE p.payment_status IN ('paid', 'auto_debited')) as paid_count
                FROM equb_groups eg
                LEFT JOIN payments p ON p.equb_id = eg.id AND p.round_number = ${roundNumber}
                WHERE eg.id = ${equbId}
                GROUP BY eg.id, eg.status, eg.total_rounds, eg.current_round, eg.contribution_amount
            `;

            if (!roundData) {
                const message = 'Equb not found';
                this.logger.warn(message);
                return { success: false, message, error: 'EQUB_NOT_FOUND', selection_method: 'fcfs' };
            }

            if (roundData.status !== 'active') {
                const message = `Equb is ${roundData.status}. Cannot draw for inactive equbs`;
                this.logger.warn(message);
                return { success: false, message, error: 'EQUB_NOT_ACTIVE', selection_method: 'fcfs' };
            }

            if (roundNumber > roundData.total_rounds) {
                const message = `Round ${roundNumber} exceeds total rounds (${roundData.total_rounds})`;
                this.logger.warn(message);
                return { success: false, message, error: 'INVALID_ROUND', selection_method: 'fcfs' };
            }

            // Check if this round already has a winner
            const [existingWinner] = await sql`
                SELECT id FROM payouts WHERE equb_id = ${equbId} AND round_number = ${roundNumber}
            `;

            if (existingWinner) {
                const message = `Round ${roundNumber} already has a winner. Cannot redraw`;
                this.logger.warn(message);
                return { success: false, message, error: 'ROUND_ALREADY_DRAWN', selection_method: 'fcfs' };
            }

            // Step 2: Get first member who paid (FCFS winner)
            const [fcfsWinner] = await sql`
                SELECT 
                    fpo.user_id,
                    fpo.payment_order,
                    fpo.paid_at,
                    u.first_name,
                    u.last_name,
                    u.phone,
                    u.email,
                    m.status as membership_status
                FROM fcfs_payment_order fpo
                JOIN users u ON u.id = fpo.user_id
                JOIN memberships m ON m.user_id = u.id AND m.equb_id = ${equbId}
                WHERE fpo.equb_id = ${equbId} 
                  AND fpo.round_number = ${roundNumber}
                  AND m.status = 'approved'
                ORDER BY fpo.payment_order ASC
                LIMIT 1
            `;

            if (!fcfsWinner) {
                const message = `No eligible members paid for round ${roundNumber}. Cannot determine FCFS winner`;
                this.logger.warn(message);
                return {
                    success: false,
                    message,
                    error: 'NO_ELIGIBLE_PAYERS',
                    selection_method: 'fcfs'
                };
            }

            // Step 3: Calculate total pot (sum of all payments for this round)
            const [potData] = await sql`
                SELECT 
                    COALESCE(SUM(p.amount), 0) as total_pot,
                    COUNT(p.id) as payment_count
                FROM payments p
                WHERE p.equb_id = ${equbId} 
                  AND p.round_number = ${roundNumber}
                  AND p.payment_status IN ('paid', 'auto_debited')
            `;

            const totalPot = potData?.total_pot || 0;

            if (totalPot <= 0) {
                const message = `No valid payments found for round ${roundNumber}`;
                this.logger.warn(message);
                return {
                    success: false,
                    message,
                    error: 'NO_PAYMENTS',
                    selection_method: 'fcfs'
                };
            }

            // Step 4: Create payout record atomically
            const [payout] = await sql`
                INSERT INTO payouts (equb_id, round_number, winner_id, total_pot_amount, status, created_at)
                VALUES (
                    ${equbId},
                    ${roundNumber},
                    ${fcfsWinner.user_id},
                    ${totalPot},
                    'pending',
                    CURRENT_TIMESTAMP
                )
                RETURNING id, equb_id, round_number, winner_id, total_pot_amount, status, created_at
            `;

            // Step 5: Log FCFS selection for audit trail
            this.logger.log(
                `FCFS winner selected for equb ${equbId}, round ${roundNumber}: ${fcfsWinner.user_id} ` +
                `(Payment Order #${fcfsWinner.payment_order}, paid at ${fcfsWinner.paid_at})`
            );

            return {
                success: true,
                winner_id: fcfsWinner.user_id,
                winner_name: `${fcfsWinner.first_name} ${fcfsWinner.last_name}`,
                cycle_id: payout.id,
                equb_id: equbId,
                selection_method: 'fcfs',
                payment_order: fcfsWinner.payment_order,
                selected_at: payout.created_at,
                message: `FCFS winner selected: ${fcfsWinner.first_name} ${fcfsWinner.last_name} (1st payer, Order #${fcfsWinner.payment_order})`
            };

        } catch (error) {
            this.logger.error(
                `FCFS selection failed for equb ${equbId}, round ${roundNumber}:`,
                error,
            );
            return {
                success: false,
                message: 'FCFS selection failed due to system error',
                error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
                selection_method: 'fcfs'
            };
        }
    }

    /**
     * Verify FCFS winner was correctly selected
     * Used for audit purposes
     *
     * @param equbId - The equb identifier
     * @param roundNumber - The round number
     * @param expectedWinnerId - The expected winner to verify
     * @returns Verification result with payment order details
     */
    async verifyFCFSWinner(
        equbId: string,
        roundNumber: number,
        expectedWinnerId: string,
    ): Promise<{
        verified: boolean;
        actual_winner_id?: string;
        expected_winner_id: string;
        payment_order?: number;
        reason?: string;
    }> {
        const sql = getPool();

        try {
            const [actualWinner] = await sql`
                SELECT 
                    fpo.user_id,
                    fpo.payment_order,
                    fpo.paid_at
                FROM fcfs_payment_order fpo
                WHERE fpo.equb_id = ${equbId} 
                  AND fpo.round_number = ${roundNumber}
                ORDER BY fpo.payment_order ASC
                LIMIT 1
            `;

            if (!actualWinner) {
                return {
                    verified: false,
                    expected_winner_id: expectedWinnerId,
                    reason: 'No payment order found for this round',
                };
            }

            const verified = actualWinner.user_id === expectedWinnerId;

            return {
                verified,
                actual_winner_id: actualWinner.user_id,
                expected_winner_id: expectedWinnerId,
                payment_order: actualWinner.payment_order,
                reason: verified ? 'Correct FCFS winner' : 'Winner mismatch - incorrect payout'
            };

        } catch (error) {
            this.logger.error(
                `FCFS verification failed for equb ${equbId}, round ${roundNumber}:`,
                error,
            );
            return {
                verified: false,
                expected_winner_id: expectedWinnerId,
                reason: error instanceof Error ? error.message : 'Verification error',
            };
        }
    }

    /**
     * Get FCFS payment order list for a round
     * Used for transparency/auditing
     *
     * @param equbId - The equb identifier
     * @param roundNumber - The round number
     * @returns List of members in payment order
     */
    async getFCFSPaymentOrder(equbId: string, roundNumber: number): Promise<any[]> {
        const sql = getPool();

        try {
            return await sql`
                SELECT 
                    fpo.payment_order,
                    fpo.user_id,
                    u.first_name,
                    u.last_name,
                    u.phone,
                    fpo.paid_at,
                    p.amount,
                    p.payment_status
                FROM fcfs_payment_order fpo
                JOIN users u ON u.id = fpo.user_id
                LEFT JOIN payments p ON p.id = fpo.payment_id
                WHERE fpo.equb_id = ${equbId} 
                  AND fpo.round_number = ${roundNumber}
                ORDER BY fpo.payment_order ASC
            `;
        } catch (error) {
            this.logger.error(
                `Failed to get FCFS payment order for equb ${equbId}, round ${roundNumber}:`,
                error,
            );
            return [];
        }
    }
}
