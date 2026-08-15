/**
 * update-kyc.dto.ts
 *
 * Validates the body of PATCH /api/v1/admin/users/:id/kyc.
 * The admin uses this to verify or reject a member's identity submission.
 */

import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateKycDto {
    @ApiProperty({
        description: 'New verification state — verified or rejected',
        enum: ['verified', 'rejected'],
        example: 'verified',
    })
    @IsIn(['verified', 'rejected'], {
        message: 'status must be verified or rejected',
    })
    status: 'verified' | 'rejected';
}