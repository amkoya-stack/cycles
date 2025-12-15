/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface TransactionFilter {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationFilter {
  page: number;
  limit: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) return false;

    const email = result.rows[0].email;
    // For now, simple check - enhance with proper role system later
    return email.endsWith('@cycle.com') || email === 'admin@example.com';
  }

  /**
   * Get all transactions with filters
   */
  async getAllTransactions(filter: TransactionFilter) {
    const offset = (filter.page - 1) * filter.limit;

    let query = `
      SELECT 
        t.id,
        t.external_reference,
        t.description,
        t.transaction_type,
        t.status,
        t.created_at,
        t.completed_at,
        u.email as user_email,
        u.phone as user_phone,
        COALESCE(
          (SELECT SUM(amount) FROM entries WHERE transaction_id = t.id AND type = 'debit'),
          0
        ) as total_amount
      FROM transactions t
      LEFT JOIN accounts a ON a.id = (
        SELECT account_id FROM entries WHERE transaction_id = t.id LIMIT 1
      )
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filter.status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.type) {
      query += ` AND t.transaction_type = $${paramIndex}`;
      params.push(filter.type);
      paramIndex++;
    }

    if (filter.startDate) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter.endDate) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(filter.endDate);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(filter.limit, offset);

    const transactions = await this.db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM transactions WHERE 1=1';
    const countParams: any[] = [];
    let countIndex = 1;

    if (filter.status) {
      countQuery += ` AND status = $${countIndex}`;
      countParams.push(filter.status);
      countIndex++;
    }

    if (filter.type) {
      countQuery += ` AND transaction_type = $${countIndex}`;
      countParams.push(filter.type);
      countIndex++;
    }

    if (filter.startDate) {
      countQuery += ` AND created_at >= $${countIndex}`;
      countParams.push(filter.startDate);
      countIndex++;
    }

    if (filter.endDate) {
      countQuery += ` AND created_at <= $${countIndex}`;
      countParams.push(filter.endDate);
      countIndex++;
    }

    const countResult = await this.db.query(countQuery, countParams);

    return {
      transactions: transactions.rows,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / filter.limit,
        ),
      },
    };
  }

  /**
   * Get system statistics
   */
  async getSystemStats() {
    // Total users
    const usersResult = await this.db.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Total transactions
    const transactionsResult = await this.db.query(
      'SELECT COUNT(*) FROM transactions',
    );
    const totalTransactions = parseInt(transactionsResult.rows[0].count);

    // Total volume (sum of all debit entries)
    const volumeResult = await this.db.query(
      "SELECT SUM(amount) FROM entries WHERE type = 'debit'",
    );
    const totalVolume = parseFloat(volumeResult.rows[0].sum) || 0;

    // Platform revenue (fee account balance)
    const revenueResult = await this.db.query(
      "SELECT balance FROM accounts WHERE account_type = 'REVENUE_FEES' AND is_system = true",
    );
    const platformRevenue =
      revenueResult.rows.length > 0
        ? Math.abs(parseFloat(revenueResult.rows[0].balance))
        : 0;

    // Active wallets (users with balance > 0)
    const activeWalletsResult = await this.db.query(
      "SELECT COUNT(*) FROM accounts WHERE user_id IS NOT NULL AND balance < 0 AND status = 'active'",
    );
    const activeWallets = parseInt(activeWalletsResult.rows[0].count);

    // Failed transactions today
    const failedTodayResult = await this.db.query(
      "SELECT COUNT(*) FROM transactions WHERE status = 'failed' AND created_at >= CURRENT_DATE",
    );
    const failedToday = parseInt(failedTodayResult.rows[0].count);

    // Pending M-Pesa callbacks
    const pendingCallbacksResult = await this.db.query(
      "SELECT COUNT(*) FROM mpesa_callbacks WHERE status = 'pending'",
    );
    const pendingCallbacks = parseInt(pendingCallbacksResult.rows[0].count);

    // Transaction type breakdown (today)
    const typeBreakdownResult = await this.db.query(`
      SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM((SELECT SUM(amount) FROM entries WHERE transaction_id = t.id AND type = 'debit')) as volume
      FROM transactions t
      WHERE created_at >= CURRENT_DATE
      GROUP BY transaction_type
    `);

    return {
      totalUsers,
      totalTransactions,
      totalVolume,
      platformRevenue,
      activeWallets,
      failedToday,
      pendingCallbacks,
      transactionTypeBreakdown: typeBreakdownResult.rows,
    };
  }

  /**
   * Get reconciliation reports
   */
  async getReconciliationReports(filter: PaginationFilter) {
    const offset = (filter.page - 1) * filter.limit;

    const result = await this.db.query(
      `SELECT * FROM reconciliation_runs 
       ORDER BY run_date DESC 
       LIMIT $1 OFFSET $2`,
      [filter.limit, offset],
    );

    const countResult = await this.db.query(
      'SELECT COUNT(*) FROM reconciliation_runs',
    );

    return {
      reports: result.rows,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / filter.limit,
        ),
      },
    };
  }

  /**
   * Get reconciliation details
   */
  async getReconciliationDetails(runId: string) {
    const runResult = await this.db.query(
      'SELECT * FROM reconciliation_runs WHERE id = $1',
      [runId],
    );

    if (runResult.rows.length === 0) {
      return null;
    }

    const itemsResult = await this.db.query(
      'SELECT * FROM reconciliation_items WHERE run_id = $1 ORDER BY created_at DESC',
      [runId],
    );

    return {
      run: runResult.rows[0],
      items: itemsResult.rows,
    };
  }

  /**
   * Get failed M-Pesa callbacks
   */
  async getFailedCallbacks(filter: PaginationFilter) {
    const offset = (filter.page - 1) * filter.limit;

    const result = await this.db.query(
      `SELECT 
        mc.*,
        u.email as user_email,
        u.phone as user_phone
       FROM mpesa_callbacks mc
       LEFT JOIN users u ON u.id = mc.user_id
       WHERE mc.status = 'failed' OR mc.result_code != 0
       ORDER BY mc.callback_received_at DESC
       LIMIT $1 OFFSET $2`,
      [filter.limit, offset],
    );

    const countResult = await this.db.query(
      "SELECT COUNT(*) FROM mpesa_callbacks WHERE status = 'failed' OR result_code != 0",
    );

    return {
      callbacks: result.rows,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / filter.limit,
        ),
      },
    };
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics() {
    // New users today
    const newTodayResult = await this.db.query(
      'SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE',
    );

    // New users this week
    const newWeekResult = await this.db.query(
      "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'",
    );

    // New users this month
    const newMonthResult = await this.db.query(
      "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'",
    );

    // KYC completion rate
    const kycCompletedResult = await this.db.query(
      "SELECT COUNT(*) FROM users WHERE kyc_status = 'verified'",
    );
    const totalUsersResult = await this.db.query('SELECT COUNT(*) FROM users');
    const kycRate =
      (parseInt(kycCompletedResult.rows[0].count) /
        parseInt(totalUsersResult.rows[0].count)) *
      100;

    return {
      newToday: parseInt(newTodayResult.rows[0].count),
      newThisWeek: parseInt(newWeekResult.rows[0].count),
      newThisMonth: parseInt(newMonthResult.rows[0].count),
      kycCompletionRate: kycRate.toFixed(2),
      totalUsers: parseInt(totalUsersResult.rows[0].count),
    };
  }
}
