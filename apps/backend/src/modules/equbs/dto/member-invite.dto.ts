/**
 * DTO for inviting members to an equb
 * Host uses this to send invitations to participants
 */
export class InviteMemberDto {
  /**
   * Email of the user to invite
   * @example "participant@example.com"
   */
  email: string;

  /**
   * Optional personal message for the invite
   * @example "Join our daily equb savings group!"
   */
  personalMessage?: string;
}

/**
 * DTO for bulk member invitations
 * Allows host to invite multiple members at once
 */
export class BulkInviteMembersDto {
  /**
   * Array of emails to invite
   * @example ["user1@example.com", "user2@example.com"]
   */
  emails: string[];

  /**
   * Optional message to include with all invites
   */
  personalMessage?: string;
}

/**
 * DTO for responding to member invitation
 */
export class RespondToInviteDto {
  /**
   * Accept or reject the invitation
   * @example "accept"
   */
  action: 'accept' | 'reject';

  /**
   * Optional reason for rejection
   * @example "I'm not interested at this time"
   */
  reason?: string;
}

/**
 * DTO for removing a member from equb
 * Host or Admin can remove members
 */
export class RemoveMemberDto {
  /**
   * Reason for removal (for audit trail)
   * @example "Member requested to leave"
   */
  reason: string;

  /**
   * Whether to refund member's contribution
   * @example true
   */
  refund: boolean;
}

/**
 * DTO for leaving an equb
 * Member can leave equb if not yet started
 */
export class LeaveEqubDto {
  /**
   * Reason for leaving
   * @example "Personal reasons"
   */
  reason?: string;
}

/**
 * Response DTO for member information
 */
export class MemberInfoDto {
  id: string;
  userId: string;
  equbId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePhoto?: string;
  joinedAt: Date;
  status: 'active' | 'pending' | 'removed' | 'left';
  trustScore?: number;
  contributionCount?: number;
}

/**
 * Response DTO for equb member list
 */
export class EqubMembersResponseDto {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  members: MemberInfoDto[];
  metadata: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * DTO for member statistics
 */
export class MemberStatsDto {
  memberId: string;
  equbId: string;
  totalContributions: number;
  totalAmountContributed: number;
  missedPayments: number;
  onTimePaymentRate: number; // percentage
  payoutsReceived: number;
  lastContributionDate?: Date;
  nextExpectedContributionDate?: Date;
  status: 'active' | 'inactive' | 'pending';
}
