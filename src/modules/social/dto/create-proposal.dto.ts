/**
 * create-proposal.dto.ts
 *
 * Validates POST /api/v1/equbs/:id/proposals
 * A participant or host submits a social fund spending proposal
 * that all group members vote on democratically.
 */

import {
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProposalDto {
    @ApiProperty({
        description: 'Short title for the proposal',
        example: 'Buy medical supplies for member Ato Kebede',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(150)
    title: string;

    @ApiProperty({
        description: 'Full description of what the funds will be used for',
        example: 'Ato Kebede requires emergency surgery. We propose using 15,000 ETB from the social fund.',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(20)
    description: string;

    @ApiProperty({
        description: 'Requested budget in ETB',
        example: 15000,
    })
    @IsNumber()
    @IsPositive()
    budget: number;
}
