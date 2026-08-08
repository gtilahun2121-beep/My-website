/**
 * bid.dto.ts
 *
 * Validates POST /api/v1/equbs/:id/bid
 * Participant submits a discount bid (B_r) to win early payout.
 *
 * Bidding auction formula (spec §3.4):
 *   P_winner = V_base − B_r
 *   D_r      = B_r / (N − 1)   redistributed to remaining members
 *   C_eff    = C − D_r          each remaining member's reduced contribution
 */

import {
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsUUID,
    Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BidDto {
    @ApiProperty({ description: 'Equb group ID' })
    @IsUUID()
    @IsNotEmpty()
    equb_id: string;

    @ApiProperty({
        description:
            'Discount bid amount in ETB (B_r). ' +
            'Must be > 0 and < total pot amount. ' +
            'Winner receives V_base − B_r.',
        example: 18000,
    })
    @IsNumber()
    @IsPositive()
    @Min(1)
    bid_amount: number;
}
