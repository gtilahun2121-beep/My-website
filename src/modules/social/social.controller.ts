/**
 * social.controller.ts
 *
 * REST endpoints for the social module:
 *
 *  POST   /api/v1/equbs/:id/proposals         → 201 | 400 | 401
 *  GET    /api/v1/equbs/:id/proposals         → 200 | 401
 *  POST   /api/v1/proposals/:id/vote          → 200 | 401 | 409
 *  PATCH  /api/v1/proposals/:id/execute       → 200 | 403 | 404  (Admin only)
 *  POST   /api/v1/tickets                     → 201 | 400 | 401
 *  GET    /api/v1/tickets/mine                → 200 | 401
 *  POST   /api/v1/admin/crb/flag              → 200 | 403         (Admin only)
 *  PATCH  /api/v1/admin/crb/:userId/release   → 200 | 403         (Admin only)
 */

import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SocialService } from './social.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

// ---------------------------------------------------------------------------
// Inline DTOs
// ---------------------------------------------------------------------------

class FileTicketDto {
    @ApiProperty({ example: 'CHAPA-abc123' })
    @IsString()
    @IsNotEmpty()
    transaction_reference: string;

    @ApiProperty({ example: 1500.00 })
    @IsNumber()
    @IsPositive()
    reported_amount: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    payment_id?: string;
}

class FlagCrbDto {
    @ApiProperty()
    @IsUUID()
    user_id: string;

    @ApiProperty({ example: 'Missed 3 consecutive payments without communication.' })
    @IsString()
    @IsNotEmpty()
    reason: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('Social')
@Controller('api/v1')
export class SocialController {
    constructor(private readonly socialService: SocialService) { }

    // ── Proposals ─────────────────────────────────────────────────────────────

    @Post('equbs/:id/proposals')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Submit a social fund spending proposal' })
    @ApiResponse({ status: 201, description: 'Proposal submitted, members notified.' })
    @ApiResponse({ status: 400, description: 'Budget exceeds social fund balance.' })
    async createProposal(
        @CurrentUser() user: JwtPayload,
        @Param('id') equbId: string,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: CreateProposalDto,
    ) {
        return this.socialService.createProposal(equbId, dto, {
            userId: user.sub,
            userRole: user.role,
        });
    }

    @Get('equbs/:id/proposals')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List social fund proposals for an Equb group' })
    @ApiResponse({ status: 200, description: 'Proposals returned.' })
    async listProposals(
        @Param('id') equbId: string,
        @Query('status') status?: string,
    ) {
        return this.socialService.listProposals(equbId, status);
    }

    // ── Vote ───────────────────────────────────────────────────────────────────

    @Post('proposals/:id/vote')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Cast a yes/no vote on a social fund proposal',
        description:
            'Each member can vote once. Proposal auto-resolves when quorum (>50%) is reached.',
    })
    @ApiResponse({ status: 200, description: 'Vote cast, tally returned.' })
    @ApiResponse({ status: 409, description: 'Already voted or proposal closed.' })
    async castVote(
        @CurrentUser() user: JwtPayload,
        @Param('id') proposalId: string,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: CastVoteDto,
    ) {
        return this.socialService.castVote(proposalId, dto, {
            userId: user.sub,
            userRole: user.role,
        });
    }

    // ── Execute Proposal (Admin only) ──────────────────────────────────────────

    @Patch('proposals/:id/execute')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Execute an approved proposal — disburse funds from social fund (Admin only)',
    })
    @ApiResponse({ status: 200, description: 'Funds disbursed.' })
    @ApiResponse({ status: 403, description: 'Admin role required.' })
    @ApiResponse({ status: 404, description: 'Proposal not found.' })
    async executeProposal(
        @CurrentUser() user: JwtPayload,
        @Param('id') proposalId: string,
    ) {
        return this.socialService.executeProposal(proposalId, {
            userId: user.sub,
            userRole: user.role,
        });
    }

    // ── Reconciliation Tickets ─────────────────────────────────────────────────

    @Post('tickets')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'File a payment dispute / reconciliation ticket' })
    @ApiResponse({ status: 201, description: 'Ticket filed, admin notified.' })
    async fileTicket(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: FileTicketDto,
    ) {
        return this.socialService.fileTicket(
            dto.transaction_reference,
            dto.reported_amount,
            dto.payment_id,
            { userId: user.sub, userRole: user.role },
        );
    }

    @Get('tickets/mine')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List my reconciliation tickets' })
    async listMyTickets(@CurrentUser() user: JwtPayload) {
        return this.socialService.listMyTickets({
            userId: user.sub,
            userRole: user.role,
        });
    }

    // ── CRB Management (Admin only) ────────────────────────────────────────────

    @Post('admin/crb/flag')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Flag a defaulting member on CRB (Admin only)' })
    @ApiResponse({ status: 200, description: 'User flagged on CRB.' })
    @ApiResponse({ status: 403, description: 'Admin role required.' })
    async flagCrb(
        @CurrentUser() user: JwtPayload,
        @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
        dto: FlagCrbDto,
    ) {
        return this.socialService.flagCrb(dto.user_id, dto.reason, {
            userId: user.sub,
            userRole: user.role,
        });
    }

    @Patch('admin/crb/:userId/release')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Release a CRB flag from a user (Admin only)' })
    @ApiResponse({ status: 200, description: 'CRB flag released.' })
    async releaseCrb(
        @CurrentUser() user: JwtPayload,
        @Param('userId') targetUserId: string,
    ) {
        return this.socialService.releaseCrb(targetUserId, {
            userId: user.sub,
            userRole: user.role,
        });
    }
}
