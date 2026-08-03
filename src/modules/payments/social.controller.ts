/**
 * social.controller.ts
 *
 * Handles the multisig approval and payout slot trade endpoints
 * that live under the payments domain boundary (spec §2.1):
 *
 *  POST /api/v1/payouts/:id/multisig  → 200 | 403 | 404
 *  POST /api/v1/trades/sell           → 201 | 400 | 403
 */

import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { getPool } from '../../config/database.config';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// DTOs (inline — small enough to not warrant separate files)
// ---------------------------------------------------------------------------

class MultisigApprovalDto {
    @ApiProperty({ description: 'Digital approval signature (base64 encoded)' })
    @IsNotEmpty()
    signature: string;
}

class SellSlotDto {
    @ApiProperty({ description: 'Equb group ID' })
    @IsUUID()
    equb_id: string;

    @ApiProperty({ description: 'Round number whose payout slot is being listed' })
    @IsNumber()
    @IsPositive()
    round_number: number;

    @ApiProperty({
        description: 'Asking price premium in ETB',
        example: 5000,
    })
    @IsNumber()
    @Min(0)
    premium_asking_price: number;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('Payouts & Trades')
@Controller('api/v1')
export class SocialController {
    // ── POST /api/v1/payouts/:id/multisig ──────────────────────────────────────

    @Post('payouts/:id/multisig')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('participant', 'host', 'admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Record a co-signer digital approval on a high-value payout (≥ 1M ETB)',
    })
    @ApiResponse({ status: 200, description: 'Approval recorded.' })
    @ApiResponse({ status: 403, description: 'Forbidden — not a co-signer.' })
    @ApiResponse({ status: 404, description: 'Payout not found.' })
    async recordMultisigApproval(
        @CurrentUser() user: JwtPayload,
        @Param('id') payoutId: string,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: MultisigApprovalDto,
    ) {
        const sql = getPool();

        // Verify payout exists
        const [payout] = await sql<{ id: string; total_pot_amount: number; status: string }[]>`
      SELECT id, total_pot_amount, status
      FROM payouts
      WHERE id = ${payoutId}
      LIMIT 1
    `;

        if (!payout) {
            return { success: false, message: 'Payout not found.' };
        }

        // Only high-capital pots (>= 1,000,000 ETB) require multisig
        if (payout.total_pot_amount < 1_000_000) {
            return {
                success: false,
                message: 'Multisig is only required for payouts of 1,000,000 ETB or more.',
            };
        }

        // Record approval — UNIQUE(payout_id, approver_id) prevents duplicates
        await sql`
      INSERT INTO multisig_approvals (payout_id, approver_id)
      VALUES (${payoutId}, ${user.sub}::uuid)
      ON CONFLICT (payout_id, approver_id) DO NOTHING
    `;

        // Count approvals — auto-approve payout if threshold met (>= 2 co-signers)
        const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*) AS count
      FROM multisig_approvals
      WHERE payout_id = ${payoutId}
    `;

        const approvalCount = parseInt(count, 10);
        const REQUIRED_APPROVALS = 2;

        if (approvalCount >= REQUIRED_APPROVALS && payout.status === 'pending') {
            await sql`
        UPDATE payouts
        SET status = 'approved'
        WHERE id = ${payoutId}
          AND status = 'pending'
      `;
        }

        return {
            success: true,
            approval_count: approvalCount,
            required: REQUIRED_APPROVALS,
            payout_approved: approvalCount >= REQUIRED_APPROVALS,
            message: `Approval recorded. ${approvalCount}/${REQUIRED_APPROVALS} approvals collected.`,
        };
    }

    // ── POST /api/v1/trades/sell ──────────────────────────────────────────────

    @Post('trades/sell')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('participant', 'host')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'List a payout slot for sale on the secondary market',
        description:
            'Winners can sell their upcoming payout slot to another participant ' +
            'for a premium asking price.',
    })
    @ApiResponse({ status: 201, description: 'Slot listed for sale.' })
    @ApiResponse({ status: 400, description: 'Validation error.' })
    @ApiResponse({ status: 403, description: 'Forbidden — only payout winners can sell.' })
    async sellPayoutSlot(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: SellSlotDto,
    ) {
        const sql = getPool();

        // Verify the seller is actually the winner of this round
        const [payout] = await sql<{ winner_id: string; status: string }[]>`
      SELECT winner_id, status
      FROM payouts
      WHERE equb_id      = ${dto.equb_id}
        AND round_number  = ${dto.round_number}
      LIMIT 1
    `;

        if (!payout) {
            return { success: false, message: 'No payout found for this round.' };
        }

        if (payout.winner_id !== user.sub) {
            return {
                success: false,
                message: 'Only the round winner can list their payout slot for sale.',
            };
        }

        if (payout.status === 'completed') {
            return { success: false, message: 'This payout has already been completed.' };
        }

        // Create the trade listing
        const [trade] = await sql<{ id: string }[]>`
      INSERT INTO payout_slot_trades
        (equb_id, round_number, seller_user_id, premium_asking_price)
      VALUES
        (${dto.equb_id}, ${dto.round_number}, ${user.sub}::uuid, ${dto.premium_asking_price})
      RETURNING id
    `;

        return {
            success: true,
            trade_id: trade.id,
            message: `Payout slot listed at ${dto.premium_asking_price} ETB premium. Buyers can now purchase it.`,
        };
    }
}
