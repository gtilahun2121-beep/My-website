/**
 * update-role.dto.ts
 *
 * Validates the body of PATCH /api/v1/admin/users/:id/role.
 * The database owner (admin) uses this to grant/revoke the website-admin
 * role for a registered user.
 */

import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
    @ApiProperty({
        description: 'New role — participant (member), host, or admin (website administrator)',
        enum: ['participant', 'host', 'admin'],
        example: 'admin',
    })
    @IsIn(['participant', 'host', 'admin'], {
        message: 'role must be participant, host, or admin',
    })
    role: 'participant' | 'host' | 'admin';
}
