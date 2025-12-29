/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { mapQueryRow, mapQueryResult, mapRow } from '../database/mapper.util';

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

      const metric = mapQueryRow<{ metricId: string }>(result);
      const metricId = metric?.metricId;

      if (!metricId) {
        throw new Error('Failed to calculate chama metrics');
      }

      // Fetch the calculated metrics
      const metrics = await this.db.query(
        `SELECT * FROM chama_metrics WHERE id = $1`,
        [metricId],
      );

      return mapQueryRow<ChamaMetrics>(metrics, {
        dateFields: ['calculatedAt', 'periodStart', 'periodEnd'],
        numberFields: [
          'totalMembers',
          'activeMembers',
          'retentionRate',
          'membersJoinedMonth',
          'membersLeftMonth',
          'averageTenureMonths',
          'totalLoansIssued',
          'activeLoans',
          'completedLoans',
          'defaultedLoans',
          'loanDefaultRate',
          'totalContributions',
          'onTimeContributions',
          'contributionConsistencyRate',
          'healthScore',
        ],
      })!;
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

    return mapQueryRow<ChamaMetrics>(result, {
      dateFields: ['calculatedAt', 'periodStart', 'periodEnd'],
      numberFields: [
        'totalMembers',
        'activeMembers',
        'retentionRate',
        'membersJoinedMonth',
        'membersLeftMonth',
        'averageTenureMonths',
        'totalLoansIssued',
        'activeLoans',
        'completedLoans',
        'defaultedLoans',
        'loanDefaultRate',
        'totalContributions',
        'onTimeContributions',
        'contributionConsistencyRate',
        'healthScore',
      ],
    })!;
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

    return mapQueryResult<ChamaMetrics>(result, {
      dateFields: ['calculatedAt', 'periodStart', 'periodEnd'],
      numberFields: [
        'totalMembers',
        'activeMembers',
        'retentionRate',
        'membersJoinedMonth',
        'membersLeftMonth',
        'averageTenureMonths',
        'totalLoansIssued',
        'activeLoans',
        'completedLoans',
        'defaultedLoans',
        'loanDefaultRate',
        'totalContributions',
        'onTimeContributions',
        'contributionConsistencyRate',
        'healthScore',
      ],
    });
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
      const metric = mapRow<ChamaMetrics>(row, {
        dateFields: ['calculatedAt', 'periodStart', 'periodEnd'],
        numberFields: [
          'totalMembers',
          'activeMembers',
          'retentionRate',
          'membersJoinedMonth',
          'membersLeftMonth',
          'averageTenureMonths',
          'totalLoansIssued',
          'activeLoans',
          'completedLoans',
          'defaultedLoans',
          'loanDefaultRate',
          'totalContributions',
          'onTimeContributions',
          'contributionConsistencyRate',
          'healthScore',
        ],
      });
      if (metric) {
        metricsMap.set(metric.chamaId, metric);
      }
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

    return mapQueryResult<ChamaMetrics>(result, {
      dateFields: ['calculatedAt', 'periodStart', 'periodEnd'],
      numberFields: [
        'totalMembers',
        'activeMembers',
        'retentionRate',
        'membersJoinedMonth',
        'membersLeftMonth',
        'averageTenureMonths',
        'totalLoansIssued',
        'activeLoans',
        'completedLoans',
        'defaultedLoans',
        'loanDefaultRate',
        'totalContributions',
        'onTimeContributions',
        'contributionConsistencyRate',
        'healthScore',
      ],
    });
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

  // mapMetrics removed - now using mapQueryRow/mapQueryResult from mapper.util
}
