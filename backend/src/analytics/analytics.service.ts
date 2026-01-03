/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get user dashboard metrics
   */
  async getUserDashboardMetrics(userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM user_dashboard_metrics WHERE user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      // Return default metrics if user not found
      return {
        chamasJoined: 0,
        chamasAdmin: 0,
        totalContributions: 0,
        contributionCount: 0,
        totalLoans: 0,
        activeLoans: 0,
        repaidLoans: 0,
        defaultedLoans: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        reputationScore: 0,
        userJoinedAt: null,
      };
    }

    const metrics = result.rows[0];
    return {
      chamasJoined: parseInt(metrics.chamas_joined || '0'),
      chamasAdmin: parseInt(metrics.chamas_admin || '0'),
      totalContributions: parseFloat(metrics.total_contributions || '0'),
      contributionCount: parseInt(metrics.contribution_count || '0'),
      totalLoans: parseInt(metrics.total_loans || '0'),
      activeLoans: parseInt(metrics.active_loans || '0'),
      repaidLoans: parseInt(metrics.repaid_loans || '0'),
      defaultedLoans: parseInt(metrics.defaulted_loans || '0'),
      totalDeposits: parseFloat(metrics.total_deposits || '0'),
      totalWithdrawals: parseFloat(metrics.total_withdrawals || '0'),
      reputationScore: parseInt(metrics.reputation_score || '0'),
      userJoinedAt: metrics.user_joined_at,
    };
  }

  /**
   * Get chama dashboard metrics
   */
  async getChamaDashboardMetrics(chamaId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM chama_dashboard_metrics WHERE chama_id = $1`,
      [chamaId],
    );

    if (result.rows.length === 0) {
      return {
        activeMembers: 0,
        pendingMembers: 0,
        totalContributions: 0,
        contributionCount: 0,
        totalPayouts: 0,
        totalLoansIssued: 0,
        activeLoansAmount: 0,
        repaidLoansAmount: 0,
        defaultedLoansAmount: 0,
        reputationScore: 0,
        chamaCreatedAt: null,
        activeDisputes: 0,
        resolvedDisputes: 0,
      };
    }

    const metrics = result.rows[0];
    return {
      chamaName: metrics.chama_name,
      activeMembers: parseInt(metrics.active_members || '0'),
      pendingMembers: parseInt(metrics.pending_members || '0'),
      totalContributions: parseFloat(metrics.total_contributions || '0'),
      contributionCount: parseInt(metrics.contribution_count || '0'),
      totalPayouts: parseFloat(metrics.total_payouts || '0'),
      totalLoansIssued: parseInt(metrics.total_loans_issued || '0'),
      activeLoansAmount: parseFloat(metrics.active_loans_amount || '0'),
      repaidLoansAmount: parseFloat(metrics.repaid_loans_amount || '0'),
      defaultedLoansAmount: parseFloat(metrics.defaulted_loans_amount || '0'),
      reputationScore: parseInt(metrics.reputation_score || '0'),
      chamaCreatedAt: metrics.chama_created_at,
      activeDisputes: parseInt(metrics.active_disputes || '0'),
      resolvedDisputes: parseInt(metrics.resolved_disputes || '0'),
    };
  }

  /**
   * Get platform dashboard metrics
   */
  async getPlatformDashboardMetrics(): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM platform_dashboard_metrics LIMIT 1`,
    );

    if (result.rows.length === 0) {
      return {
        totalUsers: 0,
        newUsers30d: 0,
        totalChamas: 0,
        newChamas30d: 0,
        totalTransactions: 0,
        transactionsToday: 0,
        transactions30d: 0,
        totalDeposits: 0,
        deposits30d: 0,
        totalContributions: 0,
        activeLoans: 0,
        activeLoansAmount: 0,
        repaidLoans: 0,
        defaultedLoans: 0,
        activeDisputes: 0,
        openFraudAlerts: 0,
      };
    }

    const metrics = result.rows[0];
    return {
      totalUsers: parseInt(metrics.total_users || '0'),
      newUsers30d: parseInt(metrics.new_users_30d || '0'),
      totalChamas: parseInt(metrics.total_chamas || '0'),
      newChamas30d: parseInt(metrics.new_chamas_30d || '0'),
      totalTransactions: parseInt(metrics.total_transactions || '0'),
      transactionsToday: parseInt(metrics.transactions_today || '0'),
      transactions30d: parseInt(metrics.transactions_30d || '0'),
      totalDeposits: parseFloat(metrics.total_deposits || '0'),
      deposits30d: parseFloat(metrics.deposits_30d || '0'),
      totalContributions: parseFloat(metrics.total_contributions || '0'),
      activeLoans: parseInt(metrics.active_loans || '0'),
      activeLoansAmount: parseFloat(metrics.active_loans_amount || '0'),
      repaidLoans: parseInt(metrics.repaid_loans || '0'),
      defaultedLoans: parseInt(metrics.defaulted_loans || '0'),
      activeDisputes: parseInt(metrics.active_disputes || '0'),
      openFraudAlerts: parseInt(metrics.open_fraud_alerts || '0'),
    };
  }

  /**
   * Get transaction volume over time
   */
  async getTransactionVolume(
    startDate?: Date,
    endDate?: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<any[]> {
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      dateFilter = `WHERE created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      dateFilter = `WHERE created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex += 1;
    } else if (endDate) {
      dateFilter = `WHERE created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex += 1;
    }

    let groupByClause = '';
    switch (groupBy) {
      case 'day':
        groupByClause = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', created_at)";
        break;
    }

    const query = `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(CASE WHEN type = 'deposit' THEN 1 END) as deposit_count,
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as deposit_amount,
        COUNT(CASE WHEN type = 'contribution' THEN 1 END) as contribution_count,
        COALESCE(SUM(CASE WHEN type = 'contribution' THEN amount ELSE 0 END), 0) as contribution_amount
      FROM financial_transactions
      ${dateFilter}
      AND status = 'completed'
      GROUP BY ${groupByClause}
      ORDER BY period ASC
    `;

    const result = await this.db.query(query, params);
    return result.rows.map((row) => ({
      period: row.period,
      transactionCount: parseInt(row.transaction_count || '0'),
      totalAmount: parseFloat(row.total_amount || '0'),
      depositCount: parseInt(row.deposit_count || '0'),
      depositAmount: parseFloat(row.deposit_amount || '0'),
      contributionCount: parseInt(row.contribution_count || '0'),
      contributionAmount: parseFloat(row.contribution_amount || '0'),
    }));
  }

  /**
   * Get geographic distribution of users/chamas
   */
  async getGeographicDistribution(): Promise<any> {
    const usersResult = await this.db.query(`
      SELECT 
        COALESCE(location, 'Unknown') as location,
        COUNT(*) as user_count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY location
      ORDER BY user_count DESC
    `);

    const chamasResult = await this.db.query(`
      SELECT 
        COALESCE(location, 'Unknown') as location,
        COUNT(*) as chama_count
      FROM chamas
      WHERE deleted_at IS NULL
      GROUP BY location
      ORDER BY chama_count DESC
    `);

    return {
      users: usersResult.rows.map((row) => ({
        location: row.location,
        count: parseInt(row.user_count || '0'),
      })),
      chamas: chamasResult.rows.map((row) => ({
        location: row.location,
        count: parseInt(row.chama_count || '0'),
      })),
    };
  }

  /**
   * Get popular chama types
   */
  async getPopularChamaTypes(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(chama_type, 'general') as chama_type,
        COUNT(*) as count,
        AVG(reputation_score) as avg_reputation
      FROM chamas
      WHERE deleted_at IS NULL
      GROUP BY chama_type
      ORDER BY count DESC
    `);

    return result.rows.map((row) => ({
      type: row.chama_type,
      count: parseInt(row.count || '0'),
      avgReputation: parseFloat(row.avg_reputation || '0'),
    }));
  }

  /**
   * Get user retention metrics
   */
  async getUserRetentionMetrics(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_30d,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '90 days') as new_users_90d,
        COUNT(*) FILTER (WHERE last_login_at >= CURRENT_DATE - INTERVAL '30 days') as active_users_30d,
        COUNT(*) FILTER (WHERE last_login_at < CURRENT_DATE - INTERVAL '90 days' AND last_login_at IS NOT NULL) as churned_users_90d
      FROM users
      WHERE deleted_at IS NULL
    `);

    const metrics = result.rows[0];
    const newUsers30d = parseInt(metrics.new_users_30d || '0');
    const activeUsers30d = parseInt(metrics.active_users_30d || '0');
    const churnedUsers90d = parseInt(metrics.churned_users_90d || '0');

    return {
      newUsers30d,
      newUsers90d: parseInt(metrics.new_users_90d || '0'),
      activeUsers30d,
      churnedUsers90d,
      retentionRate30d: newUsers30d > 0 ? (activeUsers30d / newUsers30d) * 100 : 0,
      churnRate90d: churnedUsers90d,
    };
  }

  /**
   * Track analytics event
   */
  async trackEvent(
    eventType: string,
    eventName: string,
    userId?: string,
    chamaId?: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO analytics_events (event_type, event_name, user_id, chama_id, properties)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          eventType,
          eventName,
          userId || null,
          chamaId || null,
          JSON.stringify(properties || {}),
        ],
      );
    } catch (error: any) {
      this.logger.error(`Failed to track event: ${error.message}`);
      // Don't throw - analytics tracking should not break the app
    }
  }
}

