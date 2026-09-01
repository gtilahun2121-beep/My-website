/**
 * Equb Tier Configuration Service
 * Manages Daily, Weekly, and Monthly equb tier configurations
 * Defines contribution amounts, cycle durations, pool sizes, and draw frequencies
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export enum EqubTierType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export interface EqubTierConfig {
  tierType: EqubTierType;
  duration_days: number;
  duration_readable: string;
  contribution_amount: number;
  contribution_frequency: string;
  gross_pot_per_share: number;
  pool_capacity: number;
  draw_frequency: string;
  payment_cutoff_time?: string;
  payment_window_days?: number;
  reminder_days?: number[];
  target_user_base: string;
  late_fee_percentage: number;
  platform_fee_percentage: number;
  default_grace_period_days: number;
  guarantor_requirement: boolean;
  max_early_rounds_requiring_guarantor: number;
}

export interface EqubTierComparison {
  tiers: {
    [key in EqubTierType]: EqubTierConfig;
  };
}

@Injectable()
export class EqubTierConfigService {
  private readonly logger = new Logger(EqubTierConfigService.name);

  // Tier configurations
  private readonly tierConfigs: Map<EqubTierType, EqubTierConfig> = new Map();

  constructor(private readonly dataSource: DataSource) {
    this.initializeTierConfigs();
  }

  /**
   * Initialize all tier configurations
   */
  private initializeTierConfigs(): void {
    this.logger.log('[TIER-CONFIG] Initializing equb tier configurations');

    // Daily Tier: 103 days (~3.5 months)
    this.tierConfigs.set(EqubTierType.DAILY, {
      tierType: EqubTierType.DAILY,
      duration_days: 103,
      duration_readable: '103 Days (~3.5 months)',
      contribution_amount: 300, // Can also be 1,500 ETB variant
      contribution_frequency: 'Daily',
      gross_pot_per_share: 30900, // 103 * 300
      pool_capacity: 103,
      draw_frequency: 'Daily (Every evening)',
      payment_cutoff_time: '17:00', // 5:00 PM
      payment_window_days: 1,
      reminder_days: [7, 14, 30, 60, 90], // Reminders on days 7, 14, 30, 60, 90
      target_user_base: 'Daily cash-flow traders, informal vendors',
      late_fee_percentage: 5, // 5% late fee
      platform_fee_percentage: 3.5, // 3.5% platform fee
      default_grace_period_days: 3,
      guarantor_requirement: true,
      max_early_rounds_requiring_guarantor: 15, // First 15 rounds
    });

    // Weekly Tier: 12 weeks (3 months)
    this.tierConfigs.set(EqubTierType.WEEKLY, {
      tierType: EqubTierType.WEEKLY,
      duration_days: 84, // 12 weeks * 7 days
      duration_readable: '12 Weeks (3 months)',
      contribution_amount: 2000,
      contribution_frequency: 'Weekly',
      gross_pot_per_share: 24000, // 12 * 2000
      pool_capacity: 12,
      draw_frequency: 'Weekly (Every 7th day)',
      payment_cutoff_time: '17:00', // 5:00 PM Friday
      payment_window_days: 6,
      reminder_days: [1, 4, 6], // Reminders on days 1, 4, 6 of each week
      target_user_base: 'Salaried workers, small shop owners',
      late_fee_percentage: 4, // 4% late fee
      platform_fee_percentage: 3.5,
      default_grace_period_days: 2,
      guarantor_requirement: true,
      max_early_rounds_requiring_guarantor: 4, // First 4 weeks
    });

    // Monthly Tier: 6 months
    this.tierConfigs.set(EqubTierType.MONTHLY, {
      tierType: EqubTierType.MONTHLY,
      duration_days: 180, // ~6 months
      duration_readable: '6 Months',
      contribution_amount: 10000,
      contribution_frequency: 'Monthly',
      gross_pot_per_share: 60000, // 6 * 10000
      pool_capacity: 6,
      draw_frequency: 'Monthly (Every 30th day)',
      payment_cutoff_time: '17:00', // 5:00 PM
      payment_window_days: 5, // 5-day billing window
      reminder_days: [1, 15, 25], // Reminders at start, mid, and near end of month
      target_user_base: 'Mid-scale savings, larger capital investments',
      late_fee_percentage: 3, // 3% late fee
      platform_fee_percentage: 2.9, // 2.9% platform fee
      default_grace_period_days: 5,
      guarantor_requirement: false, // Not required for monthly tier
      max_early_rounds_requiring_guarantor: 0,
    });

    this.logger.log('[TIER-CONFIG] ✓ All tier configurations initialized');
  }

  /**
   * Get a specific tier configuration
   * @param tierType - Type of tier (DAILY, WEEKLY, MONTHLY)
   * @returns Tier configuration
   */
  getTierConfig(tierType: EqubTierType): EqubTierConfig {
    this.logger.log(`[TIER-CONFIG] Fetching config | Tier: ${tierType}`);

    const config = this.tierConfigs.get(tierType);
    if (!config) {
      throw new NotFoundException(`Tier configuration for ${tierType} not found`);
    }

    return config;
  }

  /**
   * Get all tier configurations for comparison
   * @returns All tier configurations
   */
  getAllTierConfigs(): EqubTierComparison {
    this.logger.log('[TIER-CONFIG] Fetching all tier configurations');

    return {
      tiers: {
        [EqubTierType.DAILY]: this.tierConfigs.get(EqubTierType.DAILY)!,
        [EqubTierType.WEEKLY]: this.tierConfigs.get(EqubTierType.WEEKLY)!,
        [EqubTierType.MONTHLY]: this.tierConfigs.get(EqubTierType.MONTHLY)!,
      },
    };
  }

  /**
   * Calculate total pot size for a tier
   * @param tierType - Type of tier
   * @returns Total pot size (gross pot per share * pool capacity)
   */
  calculateTotalPotSize(tierType: EqubTierType): number {
    const config = this.getTierConfig(tierType);
    return config.gross_pot_per_share * config.pool_capacity;
  }

  /**
   * Calculate platform fee for a payout
   * @param tierType - Type of tier
   * @param payoutAmount - Gross payout amount
   * @returns Platform fee amount
   */
  calculatePlatformFee(tierType: EqubTierType, payoutAmount: number): number {
    const config = this.getTierConfig(tierType);
    return (payoutAmount * config.platform_fee_percentage) / 100;
  }

  /**
   * Calculate late fee for a missed payment
   * @param tierType - Type of tier
   * @returns Late fee amount
   */
  calculateLateFee(tierType: EqubTierType): number {
    const config = this.getTierConfig(tierType);
    return (config.contribution_amount * config.late_fee_percentage) / 100;
  }

  /**
   * Calculate net payout after fees
   * @param tierType - Type of tier
   * @param grossPot - Gross pot amount
   * @returns Net payout after platform fee
   */
  calculateNetPayout(tierType: EqubTierType, grossPot: number): {
    gross: number;
    platform_fee: number;
    net: number;
  } {
    const platform_fee = this.calculatePlatformFee(tierType, grossPot);
    const net = grossPot - platform_fee;

    return {
      gross: grossPot,
      platform_fee,
      net,
    };
  }

  /**
   * Get next draw date/time for a tier
   * @param tierType - Type of tier
   * @param lastDrawDate - Last draw date (optional)
   * @returns Next draw datetime
   */
  getNextDrawDateTime(
    tierType: EqubTierType,
    lastDrawDate?: Date,
  ): Date {
    const config = this.getTierConfig(tierType);
    let nextDraw = lastDrawDate || new Date();

    switch (tierType) {
      case EqubTierType.DAILY:
        // Next draw is tomorrow at cutoff time
        nextDraw = new Date(nextDraw);
        nextDraw.setDate(nextDraw.getDate() + 1);
        break;

      case EqubTierType.WEEKLY:
        // Next draw is 7 days later
        nextDraw = new Date(nextDraw);
        nextDraw.setDate(nextDraw.getDate() + 7);
        break;

      case EqubTierType.MONTHLY:
        // Next draw is 30 days later
        nextDraw = new Date(nextDraw);
        nextDraw.setDate(nextDraw.getDate() + 30);
        break;
    }

    // Set cutoff time
    const [hours, minutes] = config.payment_cutoff_time!.split(':').map(Number);
    nextDraw.setHours(hours, minutes, 0, 0);

    return nextDraw;
  }

  /**
   * Check if a tier requires guarantor verification
   * @param tierType - Type of tier
   * @param roundNumber - Round number
   * @returns True if guarantor is required
   */
  requiresGuarantorVerification(
    tierType: EqubTierType,
    roundNumber: number,
  ): boolean {
    const config = this.getTierConfig(tierType);

    if (!config.guarantor_requirement) {
      return false;
    }

    return roundNumber <= config.max_early_rounds_requiring_guarantor;
  }

  /**
   * Get payment reminders schedule for a tier
   * @param tierType - Type of tier
   * @returns Array of days when reminders should be sent
   */
  getPaymentReminderSchedule(tierType: EqubTierType): number[] {
    const config = this.getTierConfig(tierType);
    return config.reminder_days || [];
  }

  /**
   * Validate tier type
   * @param tierType - Type to validate
   * @returns True if valid
   */
  isValidTierType(tierType: any): tierType is EqubTierType {
    return Object.values(EqubTierType).includes(tierType);
  }

  /**
   * Get tier display name
   * @param tierType - Type of tier
   * @returns User-friendly tier name
   */
  getTierDisplayName(tierType: EqubTierType): string {
    switch (tierType) {
      case EqubTierType.DAILY:
        return 'Daily Equb (103 days)';
      case EqubTierType.WEEKLY:
        return 'Weekly Equb (12 weeks)';
      case EqubTierType.MONTHLY:
        return 'Monthly Equb (6 months)';
      default:
        return 'Unknown Equb Tier';
    }
  }

  /**
   * Create a new equb with tier configuration
   * @param tierType - Type of tier
   * @param equbData - Additional equb data
   * @returns Created equb
   */
  async createEqubWithTier(
    tierType: EqubTierType,
    equbData: {
      name: string;
      description: string;
      admin_id: string;
      admin_name: string;
    },
  ): Promise<any> {
    this.logger.log(`[TIER-CONFIG] Creating equb | Tier: ${tierType}, Admin: ${equbData.admin_id}`);

    const config = this.getTierConfig(tierType);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create equb record
      const equbId = `equb-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const createdAt = new Date();

      await queryRunner.manager.query(
        `INSERT INTO equbs 
         (id, name, description, tier_type, admin_id, admin_name, 
          contribution_amount, pool_capacity, gross_pot_per_share, 
          status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          equbId,
          equbData.name,
          equbData.description,
          tierType,
          equbData.admin_id,
          equbData.admin_name,
          config.contribution_amount,
          config.pool_capacity,
          config.gross_pot_per_share,
          'REGISTRATION_OPEN',
          createdAt,
          createdAt,
        ],
      );

      // Create initial payout cycle
      const cycleId = `cycle-${equbId}-1`;
      const cycleStartDate = createdAt;
      const cycleEndDate = new Date(
        cycleStartDate.getTime() + config.duration_days * 24 * 60 * 60 * 1000,
      );

      await queryRunner.manager.query(
        `INSERT INTO payout_cycles 
         (id, equb_id, cycle_number, start_date, end_date, 
          duration_days, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          cycleId,
          equbId,
          1,
          cycleStartDate,
          cycleEndDate,
          config.duration_days,
          'PENDING',
          createdAt,
          createdAt,
        ],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[TIER-CONFIG] ✓ Equb created | ID: ${equbId}, Tier: ${tierType}`,
      );

      return {
        equb_id: equbId,
        tier_type: tierType,
        name: equbData.name,
        contribution_amount: config.contribution_amount,
        pool_capacity: config.pool_capacity,
        gross_pot_per_share: config.gross_pot_per_share,
        duration_days: config.duration_days,
        status: 'REGISTRATION_OPEN',
        cycle_id: cycleId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[TIER-CONFIG] Error creating equb | ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get tier statistics summary
   * @returns Statistics for all tiers
   */
  getTierStatistics(): {
    [key in EqubTierType]: {
      tier: string;
      duration: string;
      contribution: number;
      pot_size: number;
      members: number;
      daily_volume?: number;
    };
  } {
    const stats: any = {};

    for (const [tierType, config] of this.tierConfigs.entries()) {
      const totalPot = this.calculateTotalPotSize(tierType);
      const dailyVolume =
        (config.contribution_amount * config.pool_capacity) /
        config.duration_days;

      stats[tierType] = {
        tier: this.getTierDisplayName(tierType),
        duration: config.duration_readable,
        contribution: config.contribution_amount,
        pot_size: totalPot,
        members: config.pool_capacity,
        daily_volume: Math.round(dailyVolume),
      };
    }

    return stats;
  }
}
