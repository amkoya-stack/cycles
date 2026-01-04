import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface WithdrawalLimitConfig {
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
}

@Injectable()
export class WithdrawalLimitsService {
  private readonly logger = new Logger(WithdrawalLimitsService.name);

  // Default limits (in KSh)
  private readonly DEFAULT_DAILY_LIMIT = 100000; // KSh 100,000
  private readonly DEFAULT_WEEKLY_LIMIT = 500000; // KSh 500,000
  private readonly DEFAULT_MONTHLY_LIMIT = 2000000; // KSh 2,000,000

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if withdrawal is within limits
   */
  async checkWithdrawalLimit(
    userId: string,
    amount: number,
    limitType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    // Get or create limit record
    const limit = await this.getOrCreateLimit(userId, limitType);

    // Check if withdrawal would exceed limit
    const newAmount = parseFloat(limit.current_period_amount || '0') + amount;
    const limitAmount = parseFloat(limit.amount_limit || '0');

    const allowed = newAmount <= limitAmount;
    const remaining = Math.max(0, limitAmount - parseFloat(limit.current_period_amount || '0'));

    return {
      allowed,
      remaining,
      limit: limitAmount,
    };
  }

  /**
   * Record withdrawal (update current period amount)
   */
  async recordWithdrawal(
    userId: string,
    amount: number,
    limitType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<void> {
    const limit = await this.getOrCreateLimit(userId, limitType);

    await this.db.query(
      `UPDATE withdrawal_limits 
       SET current_period_amount = current_period_amount + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [amount, limit.id],
    );

    this.logger.log(`Withdrawal recorded: ${amount} for user ${userId} (${limitType})`);
  }

  /**
   * Get or create withdrawal limit for user
   */
  private async getOrCreateLimit(
    userId: string,
    limitType: 'daily' | 'weekly' | 'monthly',
  ): Promise<any> {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    let defaultLimit: number;

    switch (limitType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);
        defaultLimit = this.DEFAULT_DAILY_LIMIT;
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - dayOfWeek);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 7);
        defaultLimit = this.DEFAULT_WEEKLY_LIMIT;
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        defaultLimit = this.DEFAULT_MONTHLY_LIMIT;
        break;
    }

    // Check for existing limit in current period
    const existing = await this.db.query(
      `SELECT * FROM withdrawal_limits 
       WHERE user_id = $1 AND limit_type = $2 
         AND period_start <= $3 AND period_end > $3`,
      [userId, limitType, now],
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new limit record
    const result = await this.db.query(
      `INSERT INTO withdrawal_limits 
       (user_id, limit_type, amount_limit, current_period_amount, period_start, period_end)
       VALUES ($1, $2, $3, 0, $4, $5)
       RETURNING *`,
      [userId, limitType, defaultLimit, periodStart, periodEnd],
    );

    return result.rows[0];
  }

  /**
   * Get current withdrawal limits and usage
   */
  async getLimits(userId: string): Promise<WithdrawalLimitConfig & { usage: any }> {
    const daily = await this.getOrCreateLimit(userId, 'daily');
    const weekly = await this.getOrCreateLimit(userId, 'weekly');
    const monthly = await this.getOrCreateLimit(userId, 'monthly');

    return {
      dailyLimit: parseFloat(daily.amount_limit || '0'),
      weeklyLimit: parseFloat(weekly.amount_limit || '0'),
      monthlyLimit: parseFloat(monthly.amount_limit || '0'),
      usage: {
        daily: {
          used: parseFloat(daily.current_period_amount || '0'),
          remaining: parseFloat(daily.amount_limit || '0') - parseFloat(daily.current_period_amount || '0'),
          periodStart: daily.period_start,
          periodEnd: daily.period_end,
        },
        weekly: {
          used: parseFloat(weekly.current_period_amount || '0'),
          remaining: parseFloat(weekly.amount_limit || '0') - parseFloat(weekly.current_period_amount || '0'),
          periodStart: weekly.period_start,
          periodEnd: weekly.period_end,
        },
        monthly: {
          used: parseFloat(monthly.current_period_amount || '0'),
          remaining: parseFloat(monthly.amount_limit || '0') - parseFloat(monthly.current_period_amount || '0'),
          periodStart: monthly.period_start,
          periodEnd: monthly.period_end,
        },
      },
    };
  }

  /**
   * Update withdrawal limits (admin only)
   */
  async updateLimits(
    userId: string,
    limits: Partial<WithdrawalLimitConfig>,
  ): Promise<void> {
    if (limits.dailyLimit !== undefined) {
      await this.updateLimit(userId, 'daily', limits.dailyLimit);
    }
    if (limits.weeklyLimit !== undefined) {
      await this.updateLimit(userId, 'weekly', limits.weeklyLimit);
    }
    if (limits.monthlyLimit !== undefined) {
      await this.updateLimit(userId, 'monthly', limits.monthlyLimit);
    }
  }

  private async updateLimit(
    userId: string,
    limitType: 'daily' | 'weekly' | 'monthly',
    amount: number,
  ): Promise<void> {
    const limit = await this.getOrCreateLimit(userId, limitType);

    await this.db.query(
      `UPDATE withdrawal_limits 
       SET amount_limit = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [amount, limit.id],
    );

    this.logger.log(`Withdrawal limit updated for user ${userId}: ${limitType} = ${amount}`);
  }
}

