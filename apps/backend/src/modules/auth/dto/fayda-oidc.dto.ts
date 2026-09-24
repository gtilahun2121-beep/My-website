/**
 * fayda-oidc.dto.ts
 * DTOs for the Fayda eSignet OIDC verification flow.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class FaydaVerifyDto {
    @ApiProperty({
        description: 'Authorization code returned by the eSignet redirect',
    })
    @IsString()
    @IsNotEmpty()
    code!: string;

    @ApiProperty({ description: 'State value saved from the initiate call' })
    @IsString()
    @IsNotEmpty()
    @Length(8, 128)
    state!: string;
}