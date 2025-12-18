/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ChamaMetrics {
  id: string;
  chamaId: string;
  totalMembers: number;
  activeMembers: number;
  retentionRate: number;
  membersJoinedMonth: number;
  membersLeftMonth: number;
  averageTenureMonths: number;
  totalLoansIssued: number;
  activeLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  loanDefaultRate: number;
  totalContributions: number;
  onTimeContributions: number;
  contributionConsistencyRate: number;
  healthScore: number;
  calculatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class ChamaMetricsService {
  private readonly logger = new Logger(ChamaMetricsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Calculate metrics for a chama
   */
  async calculateMetrics(
    chamaId: string,
    periodEnd: Date = new Date(),
  ): Promise<ChamaMetrics> {
    try {
      const result = await this.db.query(
        `SELECT calculate_chama_metrics($1, $2) as metric_id`,
        [chamaId, periodEnd],
      );

      const metricId = result.rows[0]?.metric_id;

      if (!metricId) {
        throw new Error('Failed to calculate chama metrics');
      }

      // Fetch the calculated metrics
      const metrics = await this.db.query(
        `SELECT * FROM chama_metrics WHERE id = $1`,
        [metricId],
      );

      return this.mapMetrics(metrics.rows[0]);
    } catch (error) {
      this.logger.error(
        `Failed to calculate metrics for chama ${chamaId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get latest metrics for a chama
   */
  async getLatestMetrics(chamaId: string): Promise<ChamaMetrics | null> {
    const result = await this.db.query(
      `SELECT * FROM chama_metrics 
       WHERE chama_id = $1 
       ORDER BY period_end DESC 
       LIMIT 1`,
      [chamaId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapMetrics(result.rows[0]);
  }

  /**
   * Get metrics history for a chama
   */
  async getMetricsHistory(
    chamaId: string,
    limit = 12,
  ): Promise<ChamaMetrics[]> {
    const result = await this.db.query(
      `SELECT * FROM chama_metrics 
       WHERE chama_id = $1 
       ORDER BY period_end DESC 
       LIMIT $2`,
      [chamaId, limit],
    );

    return result.rows.map((row) => this.mapMetrics(row));
  }

  /**
   * Get metrics for multiple chamas
   */
  async getBulkMetrics(chamaIds: string[]): Promise<Map<string, ChamaMetrics>> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (chama_id) *
       FROM chama_metrics 
       WHERE chama_id = ANY($1)
       ORDER BY chama_id, period_end DESC`,
      [chamaIds],
    );

    const metricsMap = new Map<string, ChamaMetrics>();
    for (const row of result.rows) {
      metricsMap.set(row.chama_id, this.mapMetrics(row));
    }

    return metricsMap;
  }

  /**
   * Get top performing chamas by health score
   */
  async getTopPerformingChamas(limit = 10): Promise<ChamaMetrics[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (chama_id) *
       FROM chama_metrics 
       ORDER BY chama_id, period_end DESC, health_score DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows.map((row) => this.mapMetrics(row));
  }

  /**
   * Calculate metrics for all chamas
   */
  async calculateAllChamaMetrics(): Promise<number> {
    try {
      this.logger.log('Calculating metrics for all chamas...');

      const chamas = await this.db.query(`SELECT id FROM chamas`);
      let calculated = 0;

      for (const chama of chamas.rows) {
        try {
          await this.calculateMetrics(chama.id);
          calculated++;
        } catch (error) {
          this.logger.error(
            `Failed to calculate metrics for chama ${chama.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Calculated metrics for ${calculated} chamas`);
      return calculated;
    } catch (error) {
      this.logger.error(
        `Failed to calculate all chama metrics: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Update ROI for investment chamas
   */
  async updateInvestmentROI(
    chamaId: string,
    initialCapital: number,
    currentCapital: number,
    totalReturns: number,
  ): Promise<void> {
    const roiPercentage =
      initialCapital > 0
        ? ((currentCapital + totalReturns - initialCapital) / initialCapital) *
          100
        : 0;

    await this.db.query(
      `UPDATE chama_metrics 
       SET initial_capital = $1,
           current_capital = $2,
           total_returns = $3,
           roi_percentage = $4,
           updated_at = NOW()
       WHERE chama_id = $5 
       AND period_end = (SELECT MAX(period_end) FROM chama_metrics WHERE chama_id = $5)`,
      [initialCapital, currentCapital, totalReturns, roiPercentage, chamaId],
    );

    // Also update chamas.roi column
    await this.db.query(`UPDATE chamas SET roi = $1 WHERE id = $2`, [
      roiPercentage,
      chamaId,
    ]);
  }

  /**
   * Map database row to ChamaMetrics
   */
  private mapMetrics(row: any): ChamaMetrics {
    return {
      id: row.id,
      chamaId: row.chama_id,
      totalMembers: row.total_members,
      activeMembers: row.active_members,
      retentionRate: parseFloat(row.retention_rate),
      membersJoinedMonth: row.members_joined_month,
      membersLeftMonth: row.members_left_month,
      averageTenureMonths: parseFloat(row.average_tenure_months),
      totalLoansIssued: row.total_loans_issued,
      activeLoans: row.active_loans,
      completedLoans: row.completed_loans,
      defaultedLoans: row.defaulted_loans,
      loanDefaultRate: parseFloat(row.loan_default_rate),
      totalContributions: row.total_contributions,
      onTimeContributions: row.on_time_contributions,
      contributionConsistencyRate: parseFloat(
        row.contribution_consistency_rate,
      ),
      healthScore: row.health_score,
      calculatedAt: new Date(row.calculated_at),
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
    };
  }
}
