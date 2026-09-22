/**
 * Member Management Controller
 *
 * Endpoints for:
 * - Inviting members (host)
 * - Accepting/rejecting invitations (member)
 * - Removing members (host/admin)
 * - Member leaving (member)
 * - Getting member lists and stats
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { MemberManagementService } from '../services/member-management.service';
import {
  InviteMemberDto,
  BulkInviteMembersDto,
  RespondToInviteDto,
  RemoveMemberDto,
  LeaveEqubDto,
  MemberInfoDto,
  MemberStatsDto,
  EqubMembersResponseDto,
} from '../dto/member-invite.dto';

@ApiTags('Equbs - Member Management')
@Controller('api/v1/equbs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MemberManagementController {
  constructor(private readonly memberManagementService: MemberManagementService) {}

  // =========================================================================
  // HOST ENDPOINTS - Invite Members
  // =========================================================================

  @Post(':equbId/members/invite')
  @UseGuards(RolesGuard)
  @Roles('host', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invite a member to an equb',
    description: 'Host can invite participants by email',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiResponse({
    status: 200,
    description: 'Invitation sent successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async inviteMember(
    @CurrentUser() user: JwtPayload,
    @Param('equbId') equbId: string,
    @Body(ValidationPipe) dto: InviteMemberDto,
  ) {
    return this.memberManagementService.inviteMember(user.sub, equbId, dto);
  }

  @Post(':equbId/members/bulk-invite')
  @UseGuards(RolesGuard)
  @Roles('host', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk invite members to an equb',
    description: 'Host can invite multiple participants at once',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiResponse({
    status: 200,
    description: 'Bulk invitations processed',
  })
  async bulkInviteMbers(
    @CurrentUser() user: JwtPayload,
    @Param('equbId') equbId: string,
    @Body(ValidationPipe) dto: BulkInviteMembersDto,
  ) {
    return this.memberManagementService.bulkInviteMembers(user.sub, equbId, dto);
  }

  // =========================================================================
  // MEMBER ENDPOINTS - Respond to Invitations
  // =========================================================================

  @Post('invitations/:invitationId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an equb invitation',
    description: 'User accepts an invitation to join an equb',
  })
  @ApiParam({ name: 'invitationId', description: 'ID of the invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
  })
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('invitationId') invitationId: string,
  ) {
    return this.memberManagementService.acceptInvitation(user.sub, invitationId);
  }

  @Post('invitations/:invitationId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject an equb invitation',
    description: 'User rejects an invitation to join an equb',
  })
  @ApiParam({ name: 'invitationId', description: 'ID of the invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation rejected successfully',
  })
  async rejectInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('invitationId') invitationId: string,
    @Body(ValidationPipe) dto: RespondToInviteDto,
  ) {
    return this.memberManagementService.rejectInvitation(
      user.sub,
      invitationId,
      dto,
    );
  }

  @Get('invitations/pending')
  @ApiOperation({
    summary: 'Get pending invitations for current user',
    description: 'Lists all pending equb invitations sent to current user',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of pending invitations',
  })
  async getPendingInvitations(
    @CurrentUser() user: JwtPayload,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.memberManagementService.getPendingInvitations(
      user.sub,
      page,
      limit,
    );
  }

  // =========================================================================
  // MEMBER ENDPOINTS - Leave Equb
  // =========================================================================

  @Post(':equbId/members/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Leave an equb',
    description: 'Member leaves an equb (only if not yet active)',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiResponse({
    status: 200,
    description: 'Successfully left the equb',
  })
  async leaveEqub(
    @CurrentUser() user: JwtPayload,
    @Param('equbId') equbId: string,
    @Body(ValidationPipe) dto: LeaveEqubDto,
  ) {
    return this.memberManagementService.leaveMember(user.sub, equbId, dto);
  }

  // =========================================================================
  // HOST/ADMIN ENDPOINTS - Manage Members
  // =========================================================================

  @Delete(':equbId/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles('host', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a member from an equb',
    description: 'Host or admin can remove members from an equb',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiParam({ name: 'memberId', description: 'ID of the member to remove' })
  @ApiResponse({
    status: 200,
    description: 'Member removed successfully',
  })
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('equbId') equbId: string,
    @Param('memberId') memberId: string,
    @Body(ValidationPipe) dto: RemoveMemberDto,
  ) {
    return this.memberManagementService.removeMember(
      user.sub,
      equbId,
      memberId,
      dto,
      user.role as 'host' | 'admin',
    );
  }

  // =========================================================================
  // PUBLIC ENDPOINTS - Member Lists and Stats
  // =========================================================================

  @Get(':equbId/members')
  @ApiOperation({
    summary: 'Get all members of an equb',
    description: 'Get list of all members in an equb with pagination',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of equb members',
    type: EqubMembersResponseDto,
  })
  async getEqubMembers(
    @Param('equbId') equbId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<EqubMembersResponseDto> {
    return this.memberManagementService.getEqubMembers(equbId, page, limit);
  }

  @Get(':equbId/members/:memberId/stats')
  @ApiOperation({
    summary: 'Get member statistics',
    description: 'Get detailed statistics for a member in an equb',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiParam({ name: 'memberId', description: 'ID of the member' })
  @ApiResponse({
    status: 200,
    description: 'Member statistics',
    type: MemberStatsDto,
  })
  async getMemberStats(
    @Param('equbId') equbId: string,
    @Param('memberId') memberId: string,
  ): Promise<MemberStatsDto> {
    return this.memberManagementService.getMemberStats(memberId, equbId);
  }

  // =========================================================================
  // SEARCH & FILTER
  // =========================================================================

  @Get(':equbId/members/search')
  @ApiOperation({
    summary: 'Search equb members',
    description: 'Search members by name or email',
  })
  @ApiParam({ name: 'equbId', description: 'ID of the equb' })
  @ApiQuery({ name: 'q', description: 'Search query (name or email)' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
  })
  async searchMembers(
    @Param('equbId') equbId: string,
    @Query('q') query: string,
  ) {
    if (!query || query.length < 2) {
      return { members: [] };
    }

    const members = await this.memberManagementService.getEqubMembers(
      equbId,
      1,
      100,
    );

    const filtered = members.members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(query.toLowerCase()) ||
        m.lastName.toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase()),
    );

    return { members: filtered };
  }
}
