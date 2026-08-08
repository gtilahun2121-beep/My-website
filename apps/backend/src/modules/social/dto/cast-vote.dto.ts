/**
 * cast-vote.dto.ts
 *
 * Validates POST /api/v1/proposals/:id/vote
 * A member casts a single yes/no vote on a social fund proposal.
 * UNIQUE(proposal_id, user_id) in the DB prevents double-voting.
 */

import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CastVoteDto {
    @ApiProperty({
        description: 'true = Approve the proposal, false = Reject it',
        example: true,
    })
    @IsBoolean()
    @IsNotEmpty()
    vote: boolean;
}
