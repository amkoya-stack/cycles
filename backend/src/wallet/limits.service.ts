/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface TransactionLimits {
  daily_deposit_limit: number;
  daily_withdrawal_limit: number;
  daily_transfer_limit: number;
  monthly_deposit_limit: number;
  monthly_withdrawal_limit: number;
  monthly_transfer_limit: number;
  max_single_deposit: number;
  max_single_withdrawal: number;
  max_single_transfer: number;
  min_deposit: number;
  min_withdrawal: number;
  min_transfer: number;
  is_suspended: boolean;
}

export interface UsageSummary {
  daily: {
    deposits: number;
    withdrawals: number;
    transfers: number;
  };
  monthly: {
    deposits: number;
    withdrawals: number;
    transfers: number;
  };
}

@Injectable()
export class LimitsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get or create transaction limits for a user
   */
  async getUserLimits(userId: string): Promise<TransactionLimits> {
    const result = await this.db.query(
      'SELECT * FROM get_or_create_user_limits($1::uuid)',
      [userId],
    );
    return result.rows[0];
  }

  /**
   * Get current usage for a user
   */
  async getUserUsage(userId: string): Promise<UsageSummary> {
    const dailyResult = await this.db.query(
      `SELECT * FROM daily_usage 
       WHERE user_id = $1 AND usage_date = CURRENT_DATE`,
      [userId],
    );

    const monthlyResult = await this.db.query(
      `SELECT * FROM monthly_usage 
       WHERE user_id = $1 AND usage_month = DATE_TRUNC('month', CURRENT_DATE)`,
      [userId],
    );

    const daily = dailyResult.rows[0] || {
      total_deposits: 0,
      total_withdrawals: 0,
      total_transfers: 0,
    };

    const monthly = monthlyResult.rows[0] || {
      total_deposits: 0,
      total_withdrawals: 0,
      total_transfers: 0,
    };

    return {
      daily: {
        deposits: parseFloat(daily.total_deposits),
        withdrawals: parseFloat(daily.total_withdrawals),
        transfers: parseFloat(daily.total_transfers),
      },
      monthly: {
        deposits: parseFloat(monthly.total_deposits),
        withdrawals: parseFloat(monthly.total_withdrawals),
        transfers: parseFloat(monthly.total_transfers),
      },
    };
  }

  /**
   * Validate transaction against limits
   * Throws BadRequestException if limit exceeded
   */
  async validateTransaction(
    userId: string,
    transactionType: 'deposit' | 'withdrawal' | 'transfer',
    amount: number,
  ): Promise<void> {
    const limits = await this.getUserLimits(userId);

    // Check if suspended
    if (limits.is_suspended) {
      throw new BadRequestException(
        'Your account is suspended. Please contact support.',
      );
    }

    const usage = await this.getUserUsage(userId);

    // Validate minimum amount
    const minField = `min_${transactionType}` as keyof TransactionLimits;
    if (amount < (limits[minField] as number)) {
      throw new BadRequestException(
        `Minimum ${transactionType} amount is KES ${limits[minField]}`,
      );
    }

    // Validate maximum single transaction
    const maxSingleField =
      `max_single_${transactionType}` as keyof TransactionLimits;
    if (amount > (limits[maxSingleField] as number)) {
      throw new BadRequestException(
        `Maximum single ${transactionType} amount is KES ${limits[maxSingleField]}`,
      );
    }

    // Validate daily limit
    const dailyLimitField =
      `daily_${transactionType}_limit` as keyof TransactionLimits;
    const dailyUsageField = `${transactionType}s`;
    const dailyUsed = usage.daily[dailyUsageField];
    const dailyLimit = limits[dailyLimitField];

    if (dailyUsed + amount > dailyLimit) {
      throw new BadRequestException(
        `Daily ${transactionType} limit exceeded. Used: KES ${dailyUsed}, Limit: KES ${dailyLimit}`,
      );
    }

    // Validate monthly limit
    const monthlyLimitField =
      `monthly_${transactionType}_limit` as keyof TransactionLimits;
    const monthlyUsageField = `${transactionType}s`;
    const monthlyUsed = usage.monthly[monthlyUsageField];
    const monthlyLimit = limits[monthlyLimitField];

    if (monthlyUsed + amount > monthlyLimit) {
      throw new BadRequestException(
        `Monthly ${transactionType} limit exceeded. Used: KES ${monthlyUsed}, Limit: KES ${monthlyLimit}`,
      );
    }
  }

  /**
   * Record transaction usage
   */
  async recordUsage(
    userId: string,
    transactionType: 'deposit' | 'withdrawal' | 'transfer',
    amount: number,
  ): Promise<void> {
    await this.db.query('SELECT update_transaction_usage($1, $2, $3)', [
      userId,
      transactionType,
      amount,
    ]);
  }

  /**
   * Update user limits (admin only)
   */
  async updateUserLimits(
    userId: string,
    updates: Partial<TransactionLimits>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) return;

    fields.push(`is_custom = true`);
    fields.push(`updated_at = NOW()`);
    values.push(userId);

    await this.db.query(
      `UPDATE transaction_limits 
       SET ${fields.join(', ')} 
       WHERE user_id = $${paramIndex}`,
      values,
    );
  }

  /**
   * Suspend user transactions
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async suspendUser(userId: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE transaction_limits 
       SET is_suspended = true, updated_at = NOW() 
       WHERE user_id = $1`,
      [userId],
    );
  }

  /**
   * Resume user transactions
   */
  async resumeUser(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE transaction_limits 
       SET is_suspended = false, updated_at = NOW() 
       WHERE user_id = $1`,
      [userId],
    );
  }
}
