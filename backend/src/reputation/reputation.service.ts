import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ReputationScore {
  id: string;
  userId: string;
  chamaId: string | null;
  totalScore: number;
  contributionScore: number;
  loanRepaymentScore: number;
  meetingAttendanceScore: number;
  votingParticipationScore: number;
  disputePenalty: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  contributionConsistencyRate: number;
  loanRepaymentRate: number;
  meetingAttendanceRate: number;
  votingRate: number;
  disputeCount: number;
  contributionStreakMonths: number;
  earlyPaymentCount: number;
  perfectAttendanceMonths: number;
  completedLoans: number;
  loanDefaultCount: number;
  lastCalculatedAt: Date;
}

interface ReputationMetrics {
  contributionMetrics: {
    totalContributions: number;
    onTimeContributions: number;
    lateContributions: number;
    missedContributions: number;
    streakMonths: number;
  };
  loanMetrics: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    earlyRepayments: number;
    onTimeRepayments: number;
    lateRepayments: number;
  };
  engagementMetrics: {
    totalMeetings: number;
    attendedMeetings: number;
    totalVotes: number;
    participatedVotes: number;
  };
  disputeMetrics: {
    totalDisputes: number;
    disputesAgainst: number;
    disputesResolved: number;
  };
}

@Injectable()
export class ReputationService {
  constructor(private db: DatabaseService) {}

  /**
   * Calculate reputation score for a user in a chama
   */
  async calculateUserReputation(
    userId: string,
    chamaId: string,
  ): Promise<ReputationScore> {
    const metrics = await this.getReputationMetrics(userId, chamaId);

    // Calculate component scores
    const contributionScore = this.calculateContributionScore(
      metrics.contributionMetrics,
    );
    const loanRepaymentScore = this.calculateLoanRepaymentScore(
      metrics.loanMetrics,
    );
    const meetingAttendanceScore = this.calculateMeetingAttendanceScore(
      metrics.engagementMetrics,
    );
    const votingParticipationScore = this.calculateVotingParticipationScore(
      metrics.engagementMetrics,
    );
    const disputePenalty = this.calculateDisputePenalty(metrics.disputeMetrics);

    // Total score (0-1000 scale)
    const totalScore = Math.max(
      0,
      contributionScore +
        loanRepaymentScore +
        meetingAttendanceScore +
        votingParticipationScore -
        disputePenalty,
    );

    // Determine tier
    const tier = this.getTierFromScore(totalScore);

    // Calculate rates
    const contributionConsistencyRate =
      metrics.contributionMetrics.totalContributions > 0
        ? (metrics.contributionMetrics.onTimeContributions /
            metrics.contributionMetrics.totalContributions) *
          100
        : 0;

    const loanRepaymentRate =
      metrics.loanMetrics.totalLoans > 0
        ? (metrics.loanMetrics.onTimeRepayments /
            metrics.loanMetrics.totalLoans) *
          100
        : 0;

    const meetingAttendanceRate =
      metrics.engagementMetrics.totalMeetings > 0
        ? (metrics.engagementMetrics.attendedMeetings /
            metrics.engagementMetrics.totalMeetings) *
          100
        : 0;

    const votingRate =
      metrics.engagementMetrics.totalVotes > 0
        ? (metrics.engagementMetrics.participatedVotes /
            metrics.engagementMetrics.totalVotes) *
          100
        : 0;

    // Upsert reputation score
    const result = await this.db.query(
      `
      INSERT INTO reputation_scores (
        user_id, chama_id, total_score, contribution_score, loan_repayment_score,
        meeting_attendance_score, voting_participation_score, dispute_penalty,
        tier, contribution_consistency_rate, loan_repayment_rate,
        meeting_attendance_rate, voting_rate, dispute_count,
        contribution_streak_months, early_payment_count, perfect_attendance_months,
        completed_loans, loan_default_count, last_calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      ON CONFLICT (user_id, chama_id) 
      DO UPDATE SET
        total_score = $3,
        contribution_score = $4,
        loan_repayment_score = $5,
        meeting_attendance_score = $6,
        voting_participation_score = $7,
        dispute_penalty = $8,
        tier = $9,
        contribution_consistency_rate = $10,
        loan_repayment_rate = $11,
        meeting_attendance_rate = $12,
        voting_rate = $13,
        dispute_count = $14,
        contribution_streak_months = $15,
        early_payment_count = $16,
        perfect_attendance_months = $17,
        completed_loans = $18,
        loan_default_count = $19,
        last_calculated_at = NOW()
      RETURNING *
    `,
      [
        userId,
        chamaId,
        totalScore,
        contributionScore,
        loanRepaymentScore,
        meetingAttendanceScore,
        votingParticipationScore,
        disputePenalty,
        tier,
        contributionConsistencyRate,
        loanRepaymentScore,
        meetingAttendanceRate,
        votingRate,
        metrics.disputeMetrics.totalDisputes,
        metrics.contributionMetrics.streakMonths,
        metrics.loanMetrics.earlyRepayments,
        0, // perfect_attendance_months (to be calculated separately)
        metrics.loanMetrics.completedLoans,
        metrics.loanMetrics.defaultedLoans,
      ],
    );

    return this.mapReputationScore(result.rows[0]);
  }

  /**
   * Get reputation metrics from database
   */
  private async getReputationMetrics(
    userId: string,
    chamaId: string,
  ): Promise<ReputationMetrics> {
    // Get contribution metrics from contribution_stats
    const contributionResult = await this.db.query(
      `
      SELECT 
        total_contributions_count,
        on_time_payments_count,
        late_payments_count,
        missed_payments_count,
        current_streak,
        penalty_free_days
      FROM contribution_stats
      WHERE user_id = $1 AND chama_id = $2
    `,
      [userId, chamaId],
    );

    const contributionData = contributionResult.rows[0] || {
      total_contributions_count: 0,
      on_time_payments_count: 0,
      late_payments_count: 0,
      missed_payments_count: 0,
      current_streak: 0,
      penalty_free_days: 0,
    };

    // Calculate streak in months (assuming weekly contributions)
    const streakMonths = Math.floor(contributionData.current_streak / 4);

    // Get loan metrics (placeholder - will be implemented when loan system is added)
    const loanMetrics = {
      totalLoans: 0,
      completedLoans: 0,
      defaultedLoans: 0,
      earlyRepayments: 0,
      onTimeRepayments: 0,
      lateRepayments: 0,
    };

    // Get engagement metrics (placeholder - will be implemented when meeting/voting systems are added)
    const engagementMetrics = {
      totalMeetings: 0,
      attendedMeetings: 0,
      totalVotes: 0,
      participatedVotes: 0,
    };

    // Get dispute metrics (placeholder)
    const disputeMetrics = {
      totalDisputes: 0,
      disputesAgainst: 0,
      disputesResolved: 0,
    };

    return {
      contributionMetrics: {
        totalContributions: contributionData.total_contributions_count,
        onTimeContributions: contributionData.on_time_payments_count,
        lateContributions: contributionData.late_payments_count,
        missedContributions: contributionData.missed_payments_count,
        streakMonths,
      },
      loanMetrics,
      engagementMetrics,
      disputeMetrics,
    };
  }

  /**
   * Calculate contribution score (0-400 points, 40% weight)
   * STRICT: Requires minimum 6 months of consistent contributions for full score
   */
  private calculateContributionScore(metrics: {
    totalContributions: number;
    onTimeContributions: number;
    lateContributions: number;
    missedContributions: number;
    streakMonths: number;
  }): number {
    if (metrics.totalContributions === 0) return 0;

    // STRICT: Minimum 6 contributions required to start scoring
    if (metrics.totalContributions < 6) {
      return Math.min(50, metrics.totalContributions * 8); // Max 50 points for <6 contributions
    }

    // Base score from consistency rate (reduced to 200 from 300)
    const consistencyRate =
      metrics.onTimeContributions / metrics.totalContributions;
    let score = consistencyRate * 200; // Up to 200 points only

    // STRICT: Streak bonus heavily time-gated (max 50 points, requires 12+ months for full bonus)
    const streakBonus = Math.min(50, metrics.streakMonths * 3); // Reduced from 10 to 3 per month
    score += streakBonus;

    // STRICT: Longevity bonus - rewards staying power (up to 100 points for 12+ months)
    const longevityBonus = Math.min(100, metrics.totalContributions * 2); // 2 points per contribution, caps at 50 contributions
    score += longevityBonus;

    // HEAVY penalties for late payments (doubled)
    const latePenalty = metrics.lateContributions * 15; // Increased from 5 to 15
    score -= latePenalty;

    // SEVERE penalties for missed payments (tripled)
    const missedPenalty = metrics.missedContributions * 30; // Increased from 10 to 30
    score -= missedPenalty;

    return Math.max(0, Math.min(400, Math.round(score)));
  }

  /**
   * Calculate loan repayment score (0-300 points, 30% weight)
   * STRICT: Any default = automatic disqualification from future loans
   */
  private calculateLoanRepaymentScore(metrics: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    earlyRepayments: number;
    onTimeRepayments: number;
    lateRepayments: number;
  }): number {
    // CRITICAL: Any defaults = -300 points (negative score)
    if (metrics.defaultedLoans > 0) {
      return -300 * metrics.defaultedLoans; // Each default = complete score elimination
    }

    if (metrics.totalLoans === 0) return 0;

    // Base score from repayment rate (reduced)
    const repaymentRate = metrics.onTimeRepayments / metrics.totalLoans;
    let score = repaymentRate * 200; // Reduced from 250 to 200

    // Small bonus for early repayments (reduced)
    const earlyBonus = Math.min(50, metrics.earlyRepayments * 5); // Reduced from 10 to 5, capped at 50
    score += earlyBonus;

    // HEAVY penalty for late repayments (increased)
    const latePenalty = metrics.lateRepayments * 40; // Doubled from 20 to 40
    score -= latePenalty;

    // Bonus for completing multiple loans successfully (trust building)
    const trustBonus = Math.min(50, metrics.completedLoans * 10); // Up to 50 points for 5+ completed loans
    score += trustBonus;

    return Math.max(-300, Math.min(300, Math.round(score)));
  }

  /**
   * Calculate meeting attendance score (0-100 points, 10% weight)
   */
  private calculateMeetingAttendanceScore(metrics: {
    totalMeetings: number;
    attendedMeetings: number;
  }): number {
    if (metrics.totalMeetings === 0) return 50; // Default score for new members

    const attendanceRate = metrics.attendedMeetings / metrics.totalMeetings;
    return Math.round(attendanceRate * 100);
  }

  /**
   * Calculate voting participation score (0-100 points, 10% weight)
   */
  private calculateVotingParticipationScore(metrics: {
    totalVotes: number;
    participatedVotes: number;
  }): number {
    if (metrics.totalVotes === 0) return 50; // Default score for new members

    const participationRate = metrics.participatedVotes / metrics.totalVotes;
    return Math.round(participationRate * 100);
  }

  /**
   * Calculate dispute penalty (0-100 points, 10% negative weight)
   */
  private calculateDisputePenalty(metrics: {
    totalDisputes: number;
    disputesAgainst: number;
    disputesResolved: number;
  }): number {
    if (metrics.totalDisputes === 0) return 0;

    // Penalty based on disputes against user
    const disputePenalty = metrics.disputesAgainst * 20;

    // Reduce penalty if disputes were resolved favorably
    const resolvedBonus = metrics.disputesResolved * 5;

    return Math.max(0, Math.min(100, disputePenalty - resolvedBonus));
  }

  /**
   * Determine tier from total score with TIME-BASED REQUIREMENTS
   * Prevents quick accumulation fraud
   */
  private getTierFromScore(
    score: number,
  ): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
    // NOTE: Actual time-based checks enforced in getLoanEligibility()
    // These are just score thresholds - time requirements apply separately
    if (score >= 850) return 'diamond'; // Increased from 800 to 850
    if (score >= 650) return 'platinum'; // Increased from 600 to 650
    if (score >= 450) return 'gold'; // Increased from 400 to 450
    if (score >= 250) return 'silver'; // Increased from 200 to 250
    return 'bronze';
  }

  /**
   * Check loan eligibility with STRICT time-based and score requirements
   * Prevents fraud from quick point accumulation
   */
  async getLoanEligibility(
    userId: string,
    chamaId: string,
    requestedLoanAmount: number,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    maxLoanAmount: number;
    requiredTier: string;
    meetsTimeRequirement: boolean;
    meetsScoreRequirement: boolean;
    tenureMonths: number;
  }> {
    // Get reputation score
    const reputation = await this.getUserReputation(userId, chamaId);
    if (!reputation) {
      return {
        eligible: false,
        reason: 'No reputation score found',
        maxLoanAmount: 0,
        requiredTier: 'bronze',
        meetsTimeRequirement: false,
        meetsScoreRequirement: false,
        tenureMonths: 0,
      };
    }

    // Check for any loan defaults - INSTANT DISQUALIFICATION
    if (reputation.loanDefaultCount > 0) {
      return {
        eligible: false,
        reason: 'Previous loan default on record - permanently ineligible',
        maxLoanAmount: 0,
        requiredTier: reputation.tier,
        meetsTimeRequirement: false,
        meetsScoreRequirement: false,
        tenureMonths: 0,
      };
    }

    // Get member tenure in chama
    const memberResult = await this.db.query(
      `SELECT joined_at FROM chama_members WHERE user_id = $1 AND chama_id = $2`,
      [userId, chamaId],
    );

    const tenureMonths = memberResult.rows[0]
      ? Math.floor(
          (Date.now() - new Date(memberResult.rows[0].joined_at).getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        )
      : 0;

    // STRICT TIME-BASED REQUIREMENTS (cannot be bypassed)
    const timeRequirements = {
      bronze: 0, // New members
      silver: 3, // 3 months minimum
      gold: 6, // 6 months minimum
      platinum: 12, // 1 year minimum
      diamond: 18, // 1.5 years minimum
    };

    const requiredTenure = timeRequirements[reputation.tier];
    const meetsTimeRequirement = tenureMonths >= requiredTenure;

    // STRICT SCORE REQUIREMENTS
    const scoreRequirements = {
      bronze: 100,
      silver: 250,
      gold: 450,
      platinum: 650,
      diamond: 850,
    };

    const meetsScoreRequirement =
      reputation.totalScore >= scoreRequirements[reputation.tier];

    // Calculate max loan amount based on tier and contributions
    const maxLoanByTier = {
      bronze: 10000, // KES 10,000
      silver: 30000, // KES 30,000
      gold: 100000, // KES 100,000
      platinum: 300000, // KES 300,000
      diamond: 1000000, // KES 1,000,000
    };

    // ADDITIONAL SAFETY: Loan amount cannot exceed 3x their total contributions
    const totalContributionsResult = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM contributions c
       JOIN contribution_cycles cc ON c.cycle_id = cc.id
       WHERE c.user_id = $1 AND cc.chama_id = $2 AND c.status = 'completed'`,
      [userId, chamaId],
    );

    const totalContributed = parseFloat(
      totalContributionsResult.rows[0]?.total || '0',
    );
    const contributionBasedLimit = totalContributed * 3;

    const maxLoanAmount = Math.min(
      maxLoanByTier[reputation.tier],
      contributionBasedLimit,
    );

    // Check eligibility
    const eligible =
      meetsTimeRequirement &&
      meetsScoreRequirement &&
      requestedLoanAmount <= maxLoanAmount &&
      reputation.contributionConsistencyRate >= 80; // Must have 80%+ on-time rate

    let reason: string | undefined;
    if (!meetsTimeRequirement) {
      reason = `Minimum ${requiredTenure} months tenure required for ${reputation.tier} tier. Current tenure: ${tenureMonths} months`;
    } else if (!meetsScoreRequirement) {
      reason = `Score ${reputation.totalScore} below ${reputation.tier} tier requirement of ${scoreRequirements[reputation.tier]}`;
    } else if (requestedLoanAmount > maxLoanAmount) {
      reason = `Requested amount ${requestedLoanAmount} exceeds maximum ${maxLoanAmount} (tier limit: ${maxLoanByTier[reputation.tier]}, contribution limit: ${contributionBasedLimit})`;
    } else if (reputation.contributionConsistencyRate < 80) {
      reason = `Contribution consistency rate ${reputation.contributionConsistencyRate}% below required 80%`;
    }

    return {
      eligible,
      reason,
      maxLoanAmount,
      requiredTier: reputation.tier,
      meetsTimeRequirement,
      meetsScoreRequirement,
      tenureMonths,
    };
  }

  /**
   * Log a reputation event
   */
  async logReputationEvent(
    userId: string,
    chamaId: string,
    eventType: string,
    eventSubtype: string,
    pointsChange: number,
    description: string,
    metadata?: any,
  ): Promise<void> {
    // Get current score
    const currentScore = await this.getUserReputation(userId, chamaId);
    const scoreBefore = currentScore?.totalScore || 0;

    await this.db.query(
      `
      INSERT INTO reputation_events (
        user_id, chama_id, event_type, event_subtype,
        points_change, score_before, score_after, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        userId,
        chamaId,
        eventType,
        eventSubtype,
        pointsChange,
        scoreBefore,
        scoreBefore + pointsChange,
        description,
        JSON.stringify(metadata || {}),
      ],
    );

    // Recalculate reputation
    await this.calculateUserReputation(userId, chamaId);
  }

  /**
   * Get user reputation score
   */
  async getUserReputation(
    userId: string,
    chamaId: string,
  ): Promise<ReputationScore | null> {
    const result = await this.db.query(
      `SELECT * FROM reputation_scores WHERE user_id = $1 AND chama_id = $2`,
      [userId, chamaId],
    );

    if (result.rows.length === 0) return null;
    return this.mapReputationScore(result.rows[0]);
  }

  /**
   * Get chama leaderboard
   */
  async getChamaLeaderboard(chamaId: string, limit: number = 50) {
    const result = await this.db.query(
      `
      SELECT * FROM chama_leaderboard
      WHERE chama_id = $1
      ORDER BY rank
      LIMIT $2
    `,
      [chamaId, limit],
    );

    return result.rows;
  }

  /**
   * Get reputation history for a user
   */
  async getUserReputationHistory(
    userId: string,
    chamaId: string,
    limit: number = 50,
  ) {
    const result = await this.db.query(
      `
      SELECT * FROM reputation_events
      WHERE user_id = $1 AND chama_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
      [userId, chamaId, limit],
    );

    return result.rows;
  }

  /**
   * Batch calculate reputation for all members in a chama
   */
  async calculateChamaReputation(chamaId: string): Promise<void> {
    const membersResult = await this.db.query(
      `SELECT user_id FROM chama_members WHERE chama_id = $1 AND status = 'active'`,
      [chamaId],
    );

    for (const member of membersResult.rows) {
      await this.calculateUserReputation(member.user_id, chamaId);
    }
  }

  /**
   * Map database row to ReputationScore object
   */
  private mapReputationScore(row: any): ReputationScore {
    return {
      id: row.id,
      userId: row.user_id,
      chamaId: row.chama_id,
      totalScore: row.total_score,
      contributionScore: row.contribution_score,
      loanRepaymentScore: row.loan_repayment_score,
      meetingAttendanceScore: row.meeting_attendance_score,
      votingParticipationScore: row.voting_participation_score,
      disputePenalty: row.dispute_penalty,
      tier: row.tier,
      contributionConsistencyRate: parseFloat(
        row.contribution_consistency_rate,
      ),
      loanRepaymentRate: parseFloat(row.loan_repayment_rate),
      meetingAttendanceRate: parseFloat(row.meeting_attendance_rate),
      votingRate: parseFloat(row.voting_rate),
      disputeCount: row.dispute_count,
      contributionStreakMonths: row.contribution_streak_months,
      earlyPaymentCount: row.early_payment_count,
      perfectAttendanceMonths: row.perfect_attendance_months,
      completedLoans: row.completed_loans,
      loanDefaultCount: row.loan_default_count,
      lastCalculatedAt: row.last_calculated_at,
    };
  }
}
