/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ChamaMetricsService, ChamaMetrics } from './chama-metrics.service';

export interface ChamaReputation {
  chamaId: string;
  chamaName: string;
  reputationScore: number; // 0-1000 scale
  tier: 'unrated' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

  // Component scores (0-100 each)
  retentionScore: number;
  loanPerformanceScore: number;
  contributionScore: number;
  activityScore: number;

  // Key metrics
  memberRetentionRate: number;
  loanDefaultRate: number;
  contributionConsistencyRate: number;
  averageTenureMonths: number;

  // Investment performance (if applicable)
  roiPercentage: number;

  // Overall health
  healthScore: number;

  // Trust indicators
  totalMembers: number;
  ageMonths: number;
  totalContributionsValue: number;

  calculatedAt: Date;
}

@Injectable()
export class ChamaReputationService {
  private readonly logger = new Logger(ChamaReputationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly metricsService: ChamaMetricsService,
  ) {}

  /**
   * Calculate comprehensive reputation score for a chama
   * Score breakdown (0-1000):
   * - Retention: 30% (0-300 points)
   * - Loan Performance: 30% (0-300 points)
   * - Contribution Consistency: 25% (0-250 points)
   * - Activity Level: 15% (0-150 points)
   */
  async calculateChamaReputation(chamaId: string): Promise<ChamaReputation> {
    // Get latest metrics
    let metrics = await this.metricsService.getLatestMetrics(chamaId);

    // Calculate if not exists
    if (!metrics) {
      metrics = await this.metricsService.calculateMetrics(chamaId);
    }

    // Get chama basic info
    const chamaResult = await this.db.query(
      `SELECT name, created_at, roi FROM chamas WHERE id = $1`,
      [chamaId],
    );

    if (chamaResult.rows.length === 0) {
      throw new Error('Chama not found');
    }

    const chama = chamaResult.rows[0];
    const ageMonths = Math.floor(
      (Date.now() - new Date(chama.created_at).getTime()) /
        (1000 * 60 * 60 * 24 * 30),
    );

    // Calculate component scores
    const retentionScore = this.calculateRetentionScore(metrics, ageMonths);
    const loanPerformanceScore = this.calculateLoanPerformanceScore(metrics);
    const contributionScore = this.calculateContributionScore(metrics);
    const activityScore = this.calculateActivityScore(metrics, ageMonths);
    const disputeScore = await this.calculateDisputeScore(chamaId, ageMonths);

    // Calculate total reputation score (0-1000)
    // Dispute score is a penalty (subtracted from base score)
    const baseScore = retentionScore + loanPerformanceScore + contributionScore + activityScore;
    const reputationScore = Math.max(0, Math.round(baseScore - disputeScore));

    // Determine tier
    const tier = this.getTierFromScore(reputationScore, ageMonths);

    return {
      chamaId,
      chamaName: chama.name,
      reputationScore,
      tier,
      retentionScore,
      loanPerformanceScore,
      contributionScore,
      activityScore,
      memberRetentionRate: metrics.retentionRate,
      loanDefaultRate: metrics.loanDefaultRate,
      contributionConsistencyRate: metrics.contributionConsistencyRate,
      averageTenureMonths: metrics.averageTenureMonths,
      roiPercentage: parseFloat(chama.roi || '0'),
      healthScore: metrics.healthScore,
      totalMembers: metrics.totalMembers,
      ageMonths,
      totalContributionsValue: metrics.totalContributions,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate retention score (0-300 points, 30% weight)
   * Higher retention = more trustworthy chama
   */
  private calculateRetentionScore(
    metrics: ChamaMetrics,
    ageMonths: number,
  ): number {
    // Base score from retention rate
    let score = (metrics.retentionRate / 100) * 200; // Up to 200 points

    // Bonus for long average tenure
    const tenureBonus = Math.min(50, metrics.averageTenureMonths * 5); // Up to 50 points
    score += tenureBonus;

    // Bonus for chama age (established chamas get credit)
    const ageBonus = Math.min(50, ageMonths * 2); // Up to 50 points for 25+ months
    score += ageBonus;

    // Penalty for high turnover (many members left)
    if (metrics.membersLeftMonth > metrics.totalMembers * 0.1) {
      score -= 50; // High turnover penalty
    }

    return Math.max(0, Math.min(300, Math.round(score)));
  }

  /**
   * Calculate loan performance score (0-300 points, 30% weight)
   * Low default rate = trustworthy lending environment
   */
  private calculateLoanPerformanceScore(metrics: ChamaMetrics): number {
    if (metrics.totalLoansIssued === 0) {
      return 150; // Default neutral score for chamas without loans
    }

    // Perfect score for 0% default rate
    const defaultRate = metrics.loanDefaultRate;
    let score = (1 - defaultRate / 100) * 250; // Up to 250 points

    // Bonus for completed loans (proven track record)
    const trackRecordBonus = Math.min(50, metrics.completedLoans * 5); // Up to 50 points
    score += trackRecordBonus;

    // SEVERE penalty for any defaults
    if (metrics.defaultedLoans > 0) {
      score -= metrics.defaultedLoans * 50; // -50 points per default
    }

    return Math.max(0, Math.min(300, Math.round(score)));
  }

  /**
   * Calculate contribution score (0-250 points, 25% weight)
   * Consistency = reliable chama
   */
  private calculateContributionScore(metrics: ChamaMetrics): number {
    if (metrics.totalContributions === 0) {
      return 0; // No contributions = no score
    }

    // Base score from consistency
    const consistencyRate = metrics.contributionConsistencyRate;
    let score = (consistencyRate / 100) * 200; // Up to 200 points

    // Bonus for high contribution volume (active chama)
    if (metrics.totalContributions > 100) {
      score += 30; // High activity bonus
    } else if (metrics.totalContributions > 50) {
      score += 20; // Medium activity bonus
    } else if (metrics.totalContributions > 20) {
      score += 10; // Some activity bonus
    }

    // Penalty for many late contributions
    const lateContributions =
      metrics.totalContributions - metrics.onTimeContributions;
    if (lateContributions > metrics.totalContributions * 0.2) {
      score -= 30; // More than 20% late = penalty
    }

    return Math.max(0, Math.min(250, Math.round(score)));
  }

  /**
   * Calculate activity score (0-150 points, 15% weight)
   * Active chamas are healthier
   */
  private calculateActivityScore(
    metrics: ChamaMetrics,
    ageMonths: number,
  ): number {
    let score = 0;

    // Member activity
    if (metrics.activeMembers > 0) {
      const activeRatio = metrics.activeMembers / metrics.totalMembers;
      score += activeRatio * 80; // Up to 80 points (increased from 60)
    }

    // Loan activity (sign of healthy lending)
    if (metrics.activeLoans > 0) {
      score += Math.min(40, metrics.activeLoans * 5); // Up to 40 points
    }

    // Contribution frequency (contributions per month)
    const contributionsPerMonth =
      ageMonths > 0 ? metrics.totalContributions / ageMonths : 0;
    if (contributionsPerMonth > 4) {
      score += 20; // Very active
    } else if (contributionsPerMonth > 2) {
      score += 10; // Active
    }

    return Math.max(0, Math.min(150, Math.round(score)));
  }

  /**
   * Calculate dispute score penalty (0-200 points penalty)
   * More disputes = higher penalty
   * Resolved disputes = lower penalty than unresolved
   * Escalated disputes = severe penalty
   */
  private async calculateDisputeScore(
    chamaId: string,
    ageMonths: number,
  ): Promise<number> {
    // Get dispute statistics
    const disputeStats = await this.db.query(
      `SELECT 
        COUNT(*) as total_disputes,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_disputes,
        COUNT(*) FILTER (WHERE status IN ('filed', 'under_review', 'discussion', 'voting')) as active_disputes,
        COUNT(*) FILTER (WHERE escalated_to_platform = TRUE) as escalated_disputes,
        COUNT(*) FILTER (WHERE dispute_type = 'loan_default') as loan_default_disputes,
        COUNT(*) FILTER (WHERE dispute_type = 'rule_violation') as rule_violation_disputes
       FROM disputes
       WHERE chama_id = $1`,
      [chamaId],
    );

    if (disputeStats.rows.length === 0) {
      return 0; // No disputes = no penalty
    }

    const stats = disputeStats.rows[0];
    const totalDisputes = parseInt(stats.total_disputes || '0');
    const resolvedDisputes = parseInt(stats.resolved_disputes || '0');
    const activeDisputes = parseInt(stats.active_disputes || '0');
    const escalatedDisputes = parseInt(stats.escalated_disputes || '0');
    const loanDefaultDisputes = parseInt(stats.loan_default_disputes || '0');
    const ruleViolationDisputes = parseInt(stats.rule_violation_disputes || '0');

    if (totalDisputes === 0) {
      return 0;
    }

    let penalty = 0;

    // Base penalty for any dispute (scaled by chama age - newer chamas penalized more)
    const ageMultiplier = ageMonths < 6 ? 1.5 : ageMonths < 12 ? 1.2 : 1.0;
    penalty += totalDisputes * 10 * ageMultiplier; // 10 points per dispute (more for new chamas)

    // Active disputes are worse than resolved ones
    penalty += activeDisputes * 20; // Additional 20 points per active dispute

    // Escalated disputes are very bad (platform intervention needed)
    penalty += escalatedDisputes * 50; // 50 points per escalated dispute

    // Loan defaults are serious (financial integrity issue)
    penalty += loanDefaultDisputes * 30; // 30 points per loan default dispute

    // Rule violations indicate governance issues
    penalty += ruleViolationDisputes * 15; // 15 points per rule violation

    // Bonus for resolving disputes (shows good conflict resolution)
    const resolutionRate = totalDisputes > 0 ? resolvedDisputes / totalDisputes : 0;
    if (resolutionRate > 0.8) {
      penalty -= 20; // Good resolution rate reduces penalty
    } else if (resolutionRate < 0.5 && totalDisputes > 3) {
      penalty += 30; // Poor resolution rate increases penalty
    }

    // Cap penalty at 200 points (20% of max reputation score)
    return Math.min(200, Math.round(penalty));
  }

  /**
   * Determine tier with AGE-BASED requirements
   * Prevents new chamas from getting high tiers too quickly
   */
  private getTierFromScore(
    score: number,
    ageMonths: number,
  ): 'unrated' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
    // New chamas (< 1 month) are always unrated
    if (ageMonths < 1) return 'unrated';

    // Age-based tier caps (prevents gaming)

    let maxTier = 'diamond';
    if (ageMonths < 18) maxTier = 'platinum';
    if (ageMonths < 12) maxTier = 'gold';
    if (ageMonths < 6) maxTier = 'silver';
    if (ageMonths < 3) maxTier = 'bronze';

    // Score-based tier (higher thresholds than user reputation)
    let scoreTier: string;
    if (score >= 850) scoreTier = 'diamond';
    else if (score >= 700) scoreTier = 'platinum';
    else if (score >= 550) scoreTier = 'gold';
    else if (score >= 400) scoreTier = 'silver';
    else if (score >= 250) scoreTier = 'bronze';
    else scoreTier = 'unrated';

    // Return the lower of the two (age caps the tier)
    const tiers = [
      'unrated',
      'bronze',
      'silver',
      'gold',
      'platinum',
      'diamond',
    ];
    const maxTierIndex = tiers.indexOf(maxTier);
    const scoreTierIndex = tiers.indexOf(scoreTier);

    return tiers[Math.min(maxTierIndex, scoreTierIndex)] as
      | 'unrated'
      | 'bronze'
      | 'silver'
      | 'gold'
      | 'platinum'
      | 'diamond';
  }

  /**
   * Get top-rated chamas
   */
  async getTopRatedChamas(limit = 10): Promise<ChamaReputation[]> {
    // Get all chamas with recent metrics
    const result = await this.db.query(
      `SELECT DISTINCT ON (chama_id) chama_id
       FROM chama_metrics
       WHERE health_score >= 50
       ORDER BY chama_id, period_end DESC, health_score DESC
       LIMIT $1`,
      [limit * 2], // Fetch more to calculate reputation
    );

    const reputations: ChamaReputation[] = [];

    for (const row of result.rows) {
      try {
        const reputation = await this.calculateChamaReputation(row.chama_id);
        reputations.push(reputation);
      } catch (_error) {
        this.logger.error(
          `Failed to calculate reputation for chama ${row.chama_id}`,
        );
      }
    }

    // Sort by reputation score and return top N
    return reputations
      .sort((a, b) => b.reputationScore - a.reputationScore)
      .slice(0, limit);
  }

  /**
   * Search chamas by minimum reputation criteria
   */
  async searchByReputation(criteria: {
    minScore?: number;
    minTier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    maxDefaultRate?: number;
    minRetentionRate?: number;
    limit?: number;
  }): Promise<ChamaReputation[]> {
    const limit = criteria.limit || 20;

    // Build query for chamas meeting basic criteria
    const whereConditions = ['cm.health_score >= 50'];
    const params: any[] = [];
    let paramIndex = 1;

    if (criteria.maxDefaultRate !== undefined) {
      whereConditions.push(`cm.loan_default_rate <= $${paramIndex}`);
      params.push(criteria.maxDefaultRate);
      paramIndex++;
    }

    if (criteria.minRetentionRate !== undefined) {
      whereConditions.push(`cm.retention_rate >= $${paramIndex}`);
      params.push(criteria.minRetentionRate);
      paramIndex++;
    }

    const query = `
      SELECT DISTINCT ON (cm.chama_id) cm.chama_id
      FROM chama_metrics cm
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY cm.chama_id, cm.period_end DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit * 2);

    const result = await this.db.query(query, params);

    const reputations: ChamaReputation[] = [];

    for (const row of result.rows) {
      try {
        const reputation = await this.calculateChamaReputation(row.chama_id);

        // Apply filters
        if (
          criteria.minScore &&
          reputation.reputationScore < criteria.minScore
        ) {
          continue;
        }

        if (criteria.minTier) {
          const tiers = [
            'unrated',
            'bronze',
            'silver',
            'gold',
            'platinum',
            'diamond',
          ];
          const minTierIndex = tiers.indexOf(criteria.minTier);
          const chamaIndex = tiers.indexOf(reputation.tier);
          if (chamaIndex < minTierIndex) {
            continue;
          }
        }

        reputations.push(reputation);
      } catch (_error) {
        this.logger.error(
          `Failed to calculate reputation for chama ${row.chama_id}`,
        );
      }
    }

    return reputations
      .sort((a, b) => b.reputationScore - a.reputationScore)
      .slice(0, limit);
  }
}
