/**
 * Member Management Service
 *
 * Handles:
 * - Inviting members to equbs
 * - Accepting/rejecting invitations
 * - Removing members (host/admin)
 * - Member leaving equbs
 * - Member statistics and tracking
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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
import { NotificationsService } from '../../notifications/notifications.service';
import { withRlsContext } from '../../../config/database.config';

interface InvitationRecord {
  id: string;
  inviter_id: string;
  invitee_email: string;
  equb_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
  responded_at?: Date;
}

@Injectable()
export class MemberManagementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Invite a single member to an equb
   * Host or Admin can invite
   */
  async inviteMember(
    hostId: string,
    equbId: string,
    dto: InviteMemberDto,
  ): Promise<{ success: boolean; message: string }> {
    return withRlsContext({ userId: hostId, userRole: 'host' }, async (tx) => {
      // Verify equb exists and is hosted by current user
      const equb = await tx`
        SELECT id, host_id, status, name
        FROM equb_groups
        WHERE id = ${equbId}
      `;

      if (!equb || equb.length === 0) {
        throw new NotFoundException(`Equb ${equbId} not found`);
      }

      if (equb[0].host_id !== hostId) {
        throw new ForbiddenException(
          'Only the host can invite members to this equb',
        );
      }

      // Check if equb is still accepting members
      if (equb[0].status !== 'open') {
        throw new BadRequestException(
          `Cannot invite members to equb in ${equb[0].status} status`,
        );
      }

      // Check if user with this email exists
      const invitee = await tx`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE email = ${dto.email}
      `;

      if (!invitee || invitee.length === 0) {
        throw new NotFoundException(
          `User with email ${dto.email} not found in system`,
        );
      }

      const inviteeId = invitee[0].id;

      // Check if already a member
      const existingMembership = await tx`
        SELECT id FROM memberships
        WHERE user_id = ${inviteeId} AND equb_id = ${equbId}
      `;

      if (existingMembership && existingMembership.length > 0) {
        throw new BadRequestException(
          `User is already a member of this equb`,
        );
      }

      // Check for existing pending invitation
      const existingInvitation = await tx`
        SELECT id FROM member_invitations
        WHERE inviter_id = ${hostId}
          AND invitee_email = ${dto.email}
          AND equb_id = ${equbId}
          AND status = 'pending'
      `;

      if (existingInvitation && existingInvitation.length > 0) {
        throw new BadRequestException(
          `Invitation already pending for this user`,
        );
      }

      // Create invitation record
      const invitation = await tx`
        INSERT INTO member_invitations
          (inviter_id, invitee_email, equb_id, status, message)
        VALUES
          (${hostId}, ${dto.email}, ${equbId}, 'pending', ${dto.personalMessage || null})
        RETURNING id, created_at
      `;

      // Send notification email to invitee
      try {
        await this.notificationsService.sendMemberInvitation(
          invitee[0].email,
          invitee[0].first_name,
          equb[0].name,
          dto.personalMessage,
          hostId,
          equbId,
        );
      } catch (error) {
        console.error('Failed to send invitation email:', error);
        // Continue even if email fails - invitation is still created
      }

      return {
        success: true,
        message: `Invitation sent to ${dto.email}`,
      };
    });
  }

  /**
   * Bulk invite members to an equb
   */
  async bulkInviteMembers(
    hostId: string,
    equbId: string,
    dto: BulkInviteMembersDto,
  ): Promise<{
    successful: number;
    failed: number;
    details: Array<{ email: string; success: boolean; message: string }>;
  }> {
    const results: Array<{ email: string; success: boolean; message: string }> =
      [];

    for (const email of dto.emails) {
      try {
        await this.inviteMember(hostId, equbId, {
          email,
          personalMessage: dto.personalMessage,
        });
        results.push({ email, success: true, message: 'Invitation sent' });
      } catch (error) {
        results.push({
          email,
          success: false,
          message: error.message || 'Failed to send invitation',
        });
      }
    }

    return {
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    };
  }

  /**
   * Accept member invitation
   * User accepts an invitation to join an equb
   */
  async acceptInvitation(
    userId: string,
    invitationId: string,
  ): Promise<{ success: boolean; message: string }> {
    return withRlsContext({ userId, userRole: 'participant' }, async (tx) => {
      // Get invitation
      const invitation = await tx`
        SELECT id, inviter_id, equb_id, status
        FROM member_invitations
        WHERE id = ${invitationId}
      `;

      if (!invitation || invitation.length === 0) {
        throw new NotFoundException(`Invitation not found`);
      }

      const inv = invitation[0];

      if (inv.status !== 'pending') {
        throw new BadRequestException(
          `Invitation is already ${inv.status}`,
        );
      }

      // Get user email
      const user = await tx`SELECT email FROM users WHERE id = ${userId}`;
      const userEmail = user[0].email;

      // Create membership
      const membership = await tx`
        INSERT INTO memberships (user_id, equb_id)
        VALUES (${userId}, ${inv.equb_id})
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      if (!membership || membership.length === 0) {
        throw new BadRequestException(
          'Could not join equb - membership already exists',
        );
      }

      // Update invitation status
      await tx`
        UPDATE member_invitations
        SET status = 'accepted', responded_at = NOW()
        WHERE id = ${invitationId}
      `;

      // Notify host of acceptance
      try {
        await this.notificationsService.sendInvitationAccepted(
          inv.inviter_id,
          userEmail,
          inv.equb_id,
        );
      } catch (error) {
        console.error('Failed to notify host:', error);
      }

      return {
        success: true,
        message: 'Successfully joined the equb',
      };
    });
  }

  /**
   * Reject member invitation
   */
  async rejectInvitation(
    userId: string,
    invitationId: string,
    dto: RespondToInviteDto,
  ): Promise<{ success: boolean; message: string }> {
    return withRlsContext({ userId, userRole: 'participant' }, async (tx) => {
      // Get invitation
      const invitation = await tx`
        SELECT id, inviter_id, equb_id, status
        FROM member_invitations
        WHERE id = ${invitationId}
      `;

      if (!invitation || invitation.length === 0) {
        throw new NotFoundException(`Invitation not found`);
      }

      if (invitation[0].status !== 'pending') {
        throw new BadRequestException(
          `Invitation is already ${invitation[0].status}`,
        );
      }

      // Update invitation status
      await tx`
        UPDATE member_invitations
        SET status = 'rejected', responded_at = NOW()
        WHERE id = ${invitationId}
      `;

      // Notify host of rejection
      try {
        await this.notificationsService.sendInvitationRejected(
          invitation[0].inviter_id,
          invitation[0].equb_id,
          dto.reason,
        );
      } catch (error) {
        console.error('Failed to notify host:', error);
      }

      return {
        success: true,
        message: 'Invitation rejected',
      };
    });
  }

  /**
   * Remove member from equb
   * Host or Admin can remove members
   */
  async removeMember(
    hostId: string,
    equbId: string,
    memberId: string,
    dto: RemoveMemberDto,
    userRole: 'host' | 'admin',
  ): Promise<{ success: boolean; message: string }> {
    return withRlsContext(
      { userId: hostId, userRole },
      async (tx) => {
        // Verify equb
        const equb = await tx`
          SELECT id, host_id, status FROM equb_groups WHERE id = ${equbId}
        `;

        if (!equb || equb.length === 0) {
          throw new NotFoundException(`Equb not found`);
        }

        // Check permission
        if (userRole === 'host' && equb[0].host_id !== hostId) {
          throw new ForbiddenException(
            'Only the host can remove members from this equb',
          );
        }

        // Check if equb is still accepting changes
        if (equb[0].status === 'completed' || equb[0].status === 'cancelled') {
          throw new BadRequestException(
            `Cannot modify equb in ${equb[0].status} status`,
          );
        }

        // Get membership
        const membership = await tx`
          SELECT id FROM memberships
          WHERE user_id = ${memberId} AND equb_id = ${equbId}
        `;

        if (!membership || membership.length === 0) {
          throw new NotFoundException(
            `Member is not part of this equb`,
          );
        }

        // Delete membership
        await tx`
          DELETE FROM memberships
          WHERE user_id = ${memberId} AND equb_id = ${equbId}
        `;

        // Log removal
        await tx`
          INSERT INTO member_removal_log
            (host_id, user_id, equb_id, reason, refund_issued)
          VALUES
            (${hostId}, ${memberId}, ${equbId}, ${dto.reason}, ${dto.refund})
        `;

        // Notify member
        try {
          await this.notificationsService.sendMemberRemoved(
            memberId,
            equbId,
            dto.reason,
            dto.refund,
          );
        } catch (error) {
          console.error('Failed to notify member:', error);
        }

        return {
          success: true,
          message: `Member removed from equb`,
        };
      },
    );
  }

  /**
   * Member leaves an equb
   */
  async leaveMember(
    userId: string,
    equbId: string,
    dto: LeaveEqubDto,
  ): Promise<{ success: boolean; message: string }> {
    return withRlsContext({ userId, userRole: 'participant' }, async (tx) => {
      // Verify membership
      const membership = await tx`
        SELECT id FROM memberships
        WHERE user_id = ${userId} AND equb_id = ${equbId}
      `;

      if (!membership || membership.length === 0) {
        throw new NotFoundException(
          `You are not a member of this equb`,
        );
      }

      // Check equb status - can only leave if not yet active or completed
      const equb = await tx`
        SELECT id, status, host_id FROM equb_groups WHERE id = ${equbId}
      `;

      if (equb[0].status === 'active') {
        throw new BadRequestException(
          'Cannot leave an active equb with ongoing rounds',
        );
      }

      // Delete membership
      await tx`
        DELETE FROM memberships
        WHERE user_id = ${userId} AND equb_id = ${equbId}
      `;

      // Log the departure
      await tx`
        INSERT INTO member_removal_log
          (host_id, user_id, equb_id, reason, refund_issued)
        VALUES
          (${equb[0].host_id}, ${userId}, ${equbId}, ${dto.reason || 'Member left'}, false)
      `;

      // Notify host
      try {
        await this.notificationsService.sendMemberLeft(
          equb[0].host_id,
          userId,
          equbId,
          dto.reason,
        );
      } catch (error) {
        console.error('Failed to notify host:', error);
      }

      return {
        success: true,
        message: 'Successfully left the equb',
      };
    });
  }

  /**
   * Get members of an equb
   */
  async getEqubMembers(
    equbId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<EqubMembersResponseDto> {
    const offset = (page - 1) * limit;

    const members = await this.dataSource.query(
      `
      SELECT
        m.id,
        m.user_id,
        m.equb_id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.profile_photo,
        m.joined_at,
        CASE WHEN m.id IS NOT NULL THEN 'active' ELSE 'pending' END as status,
        ts.trust_score
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN trust_scores ts ON u.id = ts.user_id
      WHERE m.equb_id = $1
      ORDER BY m.joined_at DESC
      LIMIT $2 OFFSET $3
      `,
      [equbId, limit, offset],
    );

    const totalResult = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM memberships WHERE equb_id = $1`,
      [equbId],
    );

    const total = parseInt(totalResult[0].count, 10);
    const activeMembers = members.length;

    return {
      totalMembers: total,
      activeMembers,
      pendingMembers: 0, // Could query pending invitations
      members: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        equbId: m.equb_id,
        email: m.email,
        firstName: m.first_name,
        lastName: m.last_name,
        phoneNumber: m.phone_number,
        profilePhoto: m.profile_photo,
        joinedAt: m.joined_at,
        status: m.status,
        trustScore: m.trust_score,
      })),
      metadata: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * Get member statistics for an equb
   */
  async getMemberStats(
    memberId: string,
    equbId: string,
  ): Promise<MemberStatsDto> {
    const stats = await this.dataSource.query(
      `
      SELECT
        m.id as member_id,
        m.equb_id,
        COUNT(p.id) as total_contributions,
        COALESCE(SUM(p.amount), 0) as total_contributed,
        SUM(CASE WHEN p.payment_status != 'paid' THEN 1 ELSE 0 END) as missed_payments,
        ROUND(100.0 * COUNT(p.id) / NULLIF(eg.member_count, 0), 2) as on_time_rate,
        MAX(p.paid_at) as last_contribution_date
      FROM memberships m
      LEFT JOIN payments p ON m.user_id = p.user_id AND m.equb_id = p.equb_id
      LEFT JOIN equb_groups eg ON m.equb_id = eg.id
      WHERE m.user_id = $1 AND m.equb_id = $2
      GROUP BY m.id, m.equb_id, eg.member_count
      `,
      [memberId, equbId],
    );

    if (!stats || stats.length === 0) {
      throw new NotFoundException('Member not found in this equb');
    }

    return {
      memberId,
      equbId,
      totalContributions: parseInt(stats[0].total_contributions, 10),
      totalAmountContributed: parseFloat(stats[0].total_contributed),
      missedPayments: parseInt(stats[0].missed_payments, 10),
      onTimePaymentRate: parseFloat(stats[0].on_time_rate) || 0,
      payoutsReceived: 0, // Query payouts table
      lastContributionDate: stats[0].last_contribution_date,
      status: 'active',
    };
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    invitations: any[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const invitations = await this.dataSource.query(
      `
      SELECT
        mi.id,
        mi.inviter_id,
        mi.equb_id,
        mi.message,
        mi.created_at,
        eg.name as equb_name,
        eg.tier_type,
        eg.contribution_amount,
        u.first_name as host_first_name,
        u.last_name as host_last_name
      FROM member_invitations mi
      JOIN equb_groups eg ON mi.equb_id = eg.id
      JOIN users u ON mi.inviter_id = u.id
      WHERE mi.invitee_email = (SELECT email FROM users WHERE id = $1)
        AND mi.status = 'pending'
      ORDER BY mi.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset],
    );

    const totalResult = await this.dataSource.query(
      `
      SELECT COUNT(*) as count
      FROM member_invitations
      WHERE invitee_email = (SELECT email FROM users WHERE id = $1)
        AND status = 'pending'
      `,
      [userId],
    );

    return {
      invitations,
      total: parseInt(totalResult[0].count, 10),
    };
  }
}
