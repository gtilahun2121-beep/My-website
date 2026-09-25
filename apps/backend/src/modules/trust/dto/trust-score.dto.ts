/**
 * Trust Score DTOs
 *
 * Data transfer objects for trust scoring, badges, and dispute management
 */

import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Badge types
 */
export enum BadgeType {
  VERIFIED_EMAIL = 'verified_email',
  VERIFIED_PHONE = 'verified_phone',
  VERIFIED_KYC = 'verified_kyc',
  TRUSTED_MEMBER = 'trusted_member',
  VIP_MEMBER = 'vip_member',
  PAYMENT_STREAK_10 = 'payment_streak_10',
  PAYMENT_STREAK_50 = 'payment_streak_50',
  PAYMENT_STREAK_100 = 'payment_streak_100',
  ORGANIZER = 'organizer',
  MENTOR = 'mentor',
  AMBASSADOR = 'ambassador',
}

/**
 * Event types that affect trust score
 */
export enum TrustEventType {
  PAYMENT_ON_TIME = 'payment_on_time',
  PAYMENT_LATE = 'payment_late',
  PAYMENT_FAILED = 'payment_failed',
  CYCLE_COMPLETED = 'cycle_completed',
  CYCLE_FAILED = 'cycle_failed',
  DISPUTE_FILED = 'dispute_filed',
  DISPUTE_RESOLVED = 'dispute_resolved',
  DISPUTE_WON = 'dispute_won',
  DISPUTE_LOST = 'dispute_lost',
  MEMBER_JOINED_EQUB = 'member_joined_equb',
  LEFT_EQUB = 'left_equb',
  KICKED_FROM_EQUB = 'kicked_from_equb',
  VERIFIED_EMAIL = 'verified_email',
  VERIFIED_PHONE = 'verified_phone',
  VERIFIED_KYC = 'verified_kyc',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  SUSPENSION = 'suspension',
  REACTIVATION = 'reactivation',
}

/**
 * Dispute types
 */
export enum DisputeType {
  PAYMENT_NOT_RECEIVED = 'payment_not_received',
  INCORRECT_AMOUNT = 'incorrect_amount',
  FRAUDULENT_CLAIM = 'fraudulent_claim',
  NON_COMPLIANCE = 'non_compliance',
  HARASSMENT = 'harassment',
  OTHER = 'other',
}

/**
 * Dispute status
 */
export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/**
 * Dispute outcome
 */
export enum DisputeOutcome {
  FILED_BY_WINS = 'filed_by_wins',
  AGAINST_USER_WINS = 'against_user_wins',
  SETTLED = 'settled',
  WITHDRAWN = 'withdrawn',
}

/**
 * Trust score status
 */
export enum TrustStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

/**
 * User trust score info DTO
 */
export class TrustScoreDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Overall trust score (0-100)', example: 75.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore: number;

  @ApiProperty({ description: 'Payment punctuality score (0-100)' })
  paymentPunctualityScore: number;

  @ApiProperty({ description: 'Cycle completion rate score (0-100)' })
  completionRateScore: number;

  @ApiProperty({ description: 'Dispute rate score (0-100)' })
  disputeRateScore: number;

  @ApiProperty({ description: 'Responsiveness score (0-100)' })
  responsivenessScore: number;

  @ApiProperty({ description: 'Total payments made' })
  totalPayments: number;

  @ApiProperty({ description: 'Payments made on time' })
  onTimePayments: number;

  @ApiProperty({ description: 'Late payments' })
  latePayments: number;

  @ApiProperty({ description: 'Cycles completed' })
  completedCycles: number;

  @ApiProperty({ description: 'Total cycles participated' })
  totalCyclesParticipated: number;

  @ApiProperty({ description: 'Active disputes' })
  activeDisputes: number;

  @ApiProperty({ description: 'Resolved disputes' })
  resolvedDisputes: number;

  @ApiProperty({ description: 'Member since date' })
  memberSince: Date;

  @ApiProperty({ description: 'Account status' })
  status: TrustStatus;

  @ApiPropertyOptional({ description: 'Suspension reason if applicable' })
  suspensionReason?: string;

  @ApiProperty({ description: 'Member tenure in days' })
  tenureDays: number;

  @ApiProperty({ description: 'Payment on-time percentage' })
  onTimePercentage: number;

  @ApiProperty({ description: 'Cycle completion percentage' })
  completionPercentage: number;
}

/**
 * Trust badge info DTO
 */
export class TrustBadgeDto {
  @ApiProperty({ description: 'Badge ID' })
  id: string;

  @ApiProperty({ description: 'Badge type', enum: BadgeType })
  badgeType: BadgeType;

  @ApiProperty({ description: 'Badge display name' })
  badgeName: string;

  @ApiProperty({ description: 'Badge description' })
  badgeDescription: string;

  @ApiPropertyOptional({ description: 'Badge emoji icon', example: '✓' })
  badgeIcon?: string;

  @ApiPropertyOptional({ description: 'Badge color', example: '#4CAF50' })
  badgeColor?: string;

  @ApiProperty({ description: 'When badge was earned' })
  earnedAt: Date;

  @ApiPropertyOptional({ description: 'When badge expires' })
  expiresAt?: Date;

  @ApiProperty({ description: 'Is badge currently active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Criteria that were met' })
  criteriaMet?: any;
}

/**
 * User trust profile DTO (public view)
 */
export class TrustProfileDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User display name' })
  displayName: string;

  @ApiProperty({ description: 'Overall trust score' })
  overallScore: number;

  @ApiProperty({ description: 'Trust status' })
  status: TrustStatus;

  @ApiProperty({ description: 'List of earned badges' })
  badges: TrustBadgeDto[];

  @ApiProperty({ description: 'Member since date' })
  memberSince: Date;

  @ApiProperty({ description: 'Number of days as member' })
  tenureDays: number;

  @ApiProperty({ description: 'Total cycles completed' })
  completedCycles: number;

  @ApiProperty({ description: 'Payment on-time percentage' })
  onTimePercentage: number;

  @ApiProperty({ description: 'Active equbs count' })
  activeEqubsCount: number;

  @ApiProperty({ description: 'Total amount paid in ETB' })
  totalAmountPaid: number;
}

/**
 * File dispute request DTO
 */
export class FileDisputeDto {
  @ApiProperty({ enum: DisputeType })
  @IsEnum(DisputeType)
  disputeType: DisputeType;

  @ApiProperty({ description: 'Dispute title', minLength: 5, maxLength: 255 })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Detailed description', minLength: 10 })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ description: 'User being disputed against' })
  @IsUUID()
  againstUserId: string;

  @ApiPropertyOptional({ description: 'Equb ID if related to equb' })
  @IsOptional()
  @IsUUID()
  equbId?: string;

  @ApiPropertyOptional({ description: 'Payment ID if related to payment' })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Supporting evidence as JSON' })
  @IsOptional()
  @IsObject()
  evidence?: {
    description?: string;
    attachments?: string[];
    witnesses?: string[];
  };
}

/**
 * Dispute info DTO
 */
export class DisputeDto {
  @ApiProperty({ description: 'Dispute ID' })
  id: string;

  @ApiProperty({ description: 'User who filed dispute' })
  filedBy: string;

  @ApiProperty({ description: 'User being disputed against' })
  againstUser: string;

  @ApiPropertyOptional({ description: 'Related equb ID' })
  equbId?: string;

  @ApiProperty({ description: 'Dispute type' })
  disputeType: DisputeType;

  @ApiProperty({ description: 'Dispute title' })
  title: string;

  @ApiProperty({ description: 'Dispute description' })
  description: string;

  @ApiProperty({ description: 'Current status' })
  status: DisputeStatus;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  resolution?: string;

  @ApiPropertyOptional({ description: 'Outcome of dispute' })
  outcome?: DisputeOutcome;

  @ApiProperty({ description: 'When dispute was filed' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'When dispute was reviewed' })
  reviewedAt?: Date;

  @ApiPropertyOptional({ description: 'When dispute was resolved' })
  resolvedAt?: Date;

  @ApiPropertyOptional({ description: 'Admin notes' })
  reviewerNotes?: string;
}

/**
 * Trust score history entry DTO
 */
export class TrustScoreHistoryDto {
  @ApiProperty({ description: 'History entry ID' })
  id: string;

  @ApiProperty({ description: 'Previous score' })
  previousScore: number;

  @ApiProperty({ description: 'New score' })
  newScore: number;

  @ApiProperty({ description: 'Score change amount' })
  scoreChange: number;

  @ApiProperty({ description: 'Event that triggered change' })
  eventType: TrustEventType;

  @ApiProperty({ description: 'Human-readable description' })
  eventDescription: string;

  @ApiPropertyOptional({ description: 'Additional context about the event' })
  eventMetadata?: any;

  @ApiPropertyOptional({ description: 'Reason for the change' })
  reason?: string;

  @ApiProperty({ description: 'When this change occurred' })
  createdAt: Date;
}

/**
 * Trust score history response DTO
 */
export class TrustScoreHistoryResponseDto {
  @ApiProperty({ description: 'History entries' })
  history: TrustScoreHistoryDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Entries per page' })
  limit: number;
}

/**
 * Update dispute request DTO (admin)
 */
export class UpdateDisputeDto {
  @ApiPropertyOptional({ enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiPropertyOptional({ enum: DisputeOutcome })
  @IsOptional()
  @IsEnum(DisputeOutcome)
  outcome?: DisputeOutcome;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiPropertyOptional({ description: 'Admin notes' })
  @IsOptional()
  @IsString()
  reviewerNotes?: string;

  @ApiPropertyOptional({ description: 'Score impact for filer' })
  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(50)
  impactOnFiledBy?: number;

  @ApiPropertyOptional({ description: 'Score impact for accused' })
  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(50)
  impactOnAgainst?: number;
}

/**
 * Manual trust score adjustment DTO (admin)
 */
export class AdjustTrustScoreDto {
  @ApiProperty({ description: 'Amount to adjust by (-50 to +50)' })
  @IsNumber()
  @Min(-50)
  @Max(50)
  adjustmentAmount: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  @MinLength(10)
  reason: string;

  @ApiPropertyOptional({ description: 'Event type for this adjustment' })
  @IsOptional()
  @IsEnum(TrustEventType)
  eventType?: TrustEventType;
}

/**
 * Trust score leaderboard entry DTO
 */
export class TrustLeaderboardEntryDto {
  @ApiProperty({ description: 'User rank' })
  rank: number;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User display name' })
  displayName: string;

  @ApiProperty({ description: 'Overall trust score' })
  overallScore: number;

  @ApiProperty({ description: 'Badges earned' })
  badgesCount: number;

  @ApiProperty({ description: 'Completed cycles' })
  completedCycles: number;

  @ApiProperty({ description: 'Member tenure in days' })
  tenureDays: number;
}

/**
 * Trust score leaderboard response DTO
 */
export class TrustLeaderboardResponseDto {
  @ApiProperty({ description: 'Leaderboard entries' })
  entries: TrustLeaderboardEntryDto[];

  @ApiProperty({ description: 'Total users ranked' })
  totalUsers: number;

  @ApiPropertyOptional({ description: 'Current user rank' })
  currentUserRank?: number;

  @ApiPropertyOptional({ description: 'Current user score' })
  currentUserScore?: number;
}

/**
 * Trust statistics DTO
 */
export class TrustStatsDto {
  @ApiProperty({ description: 'Average trust score system-wide' })
  averageTrustScore: number;

  @ApiProperty({ description: 'Number of active users' })
  activeUsers: number;

  @ApiProperty({ description: 'Number of suspended users' })
  suspendedUsers: number;

  @ApiProperty({ description: 'Number of banned users' })
  bannedUsers: number;

  @ApiProperty({ description: 'Total disputes filed' })
  totalDisputes: number;

  @ApiProperty({ description: 'Open disputes' })
  openDisputes: number;

  @ApiProperty({ description: 'Resolved disputes' })
  resolvedDisputes: number;

  @ApiProperty({ description: 'Number of verified users (KYC)' })
  verifiedUsers: number;

  @ApiProperty({ description: 'Most common badge' })
  mostCommonBadge?: BadgeType;

  @ApiProperty({ description: 'Badge distribution' })
  badgeDistribution: {
    badgeType: BadgeType;
    count: number;
  }[];
}
