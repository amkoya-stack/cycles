import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  iconUrl: string | null;
  pointsRequired: number;
  criteria: any;
  isActive: boolean;
}

export interface BadgeAward {
  id: string;
  badgeId: string;
  userId: string;
  chamaId: string | null;
  awardedAt: Date;
  revokedAt: Date | null;
  isActive: boolean;
  awardReason: string;
  awardedBySystem: boolean;
  badge?: Badge;
}

@Injectable()
export class BadgeService {
  constructor(private db: DatabaseService) {}

  /**
   * Check and award badges to a user based on their reputation
   */
  async checkAndAwardBadges(userId: string, chamaId: string): Promise<void> {
    // Get user's reputation score
    const reputationResult = await this.db.query(
      `SELECT * FROM reputation_scores WHERE user_id = $1 AND chama_id = $2`,
      [userId, chamaId],
    );

    if (reputationResult.rows.length === 0) return;

    const reputation = reputationResult.rows[0];

    // Check tier badges
    await this.awardTierBadge(userId, chamaId, reputation.total_score);

    // Check achievement badges
    await this.checkEarlyBirdBadge(userId, chamaId, reputation);
    await this.checkPerfectAttendanceBadge(userId, chamaId, reputation);
    await this.checkZeroDefaultsBadge(userId, chamaId, reputation);
    await this.checkStreakMasterBadge(userId, chamaId, reputation);
    await this.checkTopContributorBadge(userId, chamaId);
  }

  /**
   * Award tier badge based on total score
   */
  private async awardTierBadge(
    userId: string,
    chamaId: string,
    totalScore: number,
  ): Promise<void> {
    let tierCode: string;

    if (totalScore >= 800) tierCode = 'DIAMOND_MEMBER';
    else if (totalScore >= 600) tierCode = 'PLATINUM_MEMBER';
    else if (totalScore >= 400) tierCode = 'GOLD_MEMBER';
    else if (totalScore >= 200) tierCode = 'SILVER_MEMBER';
    else tierCode = 'BRONZE_MEMBER';

    // Get badge
    const badgeResult = await this.db.query(
      `SELECT * FROM badges WHERE code = $1`,
      [tierCode],
    );

    if (badgeResult.rows.length === 0) return;

    const badge = badgeResult.rows[0];

    // Award the badge (revoke lower tier badges)
    await this.awardBadge(
      badge.id,
      userId,
      chamaId,
      `Achieved ${badge.name} tier with ${totalScore} points`,
    );

    // Revoke lower tier badges
    const tierOrder = [
      'BRONZE_MEMBER',
      'SILVER_MEMBER',
      'GOLD_MEMBER',
      'PLATINUM_MEMBER',
      'DIAMOND_MEMBER',
    ];
    const currentTierIndex = tierOrder.indexOf(tierCode);

    for (let i = 0; i < currentTierIndex; i++) {
      await this.revokeBadgeByCode(tierOrder[i], userId, chamaId);
    }
  }

  /**
   * Check and award Early Bird badge
   */
  private async checkEarlyBirdBadge(
    userId: string,
    chamaId: string,
    reputation: any,
  ): Promise<void> {
    if (reputation.early_payment_count >= 10) {
      const badgeResult = await this.db.query(
        `SELECT * FROM badges WHERE code = 'EARLY_BIRD'`,
      );

      if (badgeResult.rows.length > 0) {
        await this.awardBadge(
          badgeResult.rows[0].id,
          userId,
          chamaId,
          `Made ${reputation.early_payment_count} early payments`,
        );
      }
    }
  }

  /**
   * Check and award Perfect Attendance badge
   */
  private async checkPerfectAttendanceBadge(
    userId: string,
    chamaId: string,
    reputation: any,
  ): Promise<void> {
    if (reputation.perfect_attendance_months >= 6) {
      const badgeResult = await this.db.query(
        `SELECT * FROM badges WHERE code = 'PERFECT_ATTENDANCE'`,
      );

      if (badgeResult.rows.length > 0) {
        await this.awardBadge(
          badgeResult.rows[0].id,
          userId,
          chamaId,
          `Perfect attendance for ${reputation.perfect_attendance_months} months`,
        );
      }
    }
  }

  /**
   * Check and award Zero Defaults badge
   */
  private async checkZeroDefaultsBadge(
    userId: string,
    chamaId: string,
    reputation: any,
  ): Promise<void> {
    if (
      reputation.loan_default_count === 0 &&
      reputation.completed_loans >= 3
    ) {
      const badgeResult = await this.db.query(
        `SELECT * FROM badges WHERE code = 'ZERO_DEFAULTS'`,
      );

      if (badgeResult.rows.length > 0) {
        await this.awardBadge(
          badgeResult.rows[0].id,
          userId,
          chamaId,
          `Completed ${reputation.completed_loans} loans with zero defaults`,
        );
      }
    }
  }

  /**
   * Check and award Streak Master badge
   */
  private async checkStreakMasterBadge(
    userId: string,
    chamaId: string,
    reputation: any,
  ): Promise<void> {
    if (reputation.contribution_streak_months >= 12) {
      const badgeResult = await this.db.query(
        `SELECT * FROM badges WHERE code = 'STREAK_MASTER'`,
      );

      if (badgeResult.rows.length > 0) {
        await this.awardBadge(
          badgeResult.rows[0].id,
          userId,
          chamaId,
          `Maintained ${reputation.contribution_streak_months} month contribution streak`,
        );
      }
    }
  }

  /**
   * Check and award Top Contributor badge
   */
  private async checkTopContributorBadge(
    userId: string,
    chamaId: string,
  ): Promise<void> {
    // Get user's rank in the chama
    const rankResult = await this.db.query(
      `
      SELECT rank, (SELECT COUNT(*) FROM reputation_scores WHERE chama_id = $2) as total_members
      FROM chama_leaderboard
      WHERE user_id = $1 AND chama_id = $2
    `,
      [userId, chamaId],
    );

    if (rankResult.rows.length === 0) return;

    const { rank, total_members } = rankResult.rows[0];
    const percentile = ((total_members - rank + 1) / total_members) * 100;

    if (percentile >= 90) {
      const badgeResult = await this.db.query(
        `SELECT * FROM badges WHERE code = 'TOP_CONTRIBUTOR'`,
      );

      if (badgeResult.rows.length > 0) {
        await this.awardBadge(
          badgeResult.rows[0].id,
          userId,
          chamaId,
          `Ranked in top 10% of contributors (Rank ${rank} of ${total_members})`,
        );
      }
    } else {
      // Revoke badge if user falls below threshold
      await this.revokeBadgeByCode('TOP_CONTRIBUTOR', userId, chamaId);
    }
  }

  /**
   * Award a badge to a user
   */
  async awardBadge(
    badgeId: string,
    userId: string,
    chamaId: string | null,
    reason: string,
  ): Promise<BadgeAward> {
    // Check if badge is already awarded
    const existingResult = await this.db.query(
      `
      SELECT * FROM badge_awards 
      WHERE badge_id = $1 AND user_id = $2 AND chama_id = $3 AND is_active = true
    `,
      [badgeId, userId, chamaId],
    );

    if (existingResult.rows.length > 0) {
      return this.mapBadgeAward(existingResult.rows[0]);
    }

    // Award the badge
    const result = await this.db.query(
      `
      INSERT INTO badge_awards (badge_id, user_id, chama_id, award_reason, awarded_by_system)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (badge_id, user_id, chama_id)
      DO UPDATE SET 
        is_active = true,
        revoked_at = NULL,
        award_reason = $4,
        awarded_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [badgeId, userId, chamaId, reason],
    );

    return this.mapBadgeAward(result.rows[0]);
  }

  /**
   * Revoke a badge from a user
   */
  async revokeBadge(badgeAwardId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE badge_awards
      SET is_active = false, revoked_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
      [badgeAwardId],
    );
  }

  /**
   * Revoke a badge by code
   */
  private async revokeBadgeByCode(
    badgeCode: string,
    userId: string,
    chamaId: string,
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE badge_awards ba
      SET is_active = false, revoked_at = CURRENT_TIMESTAMP
      FROM badges b
      WHERE ba.badge_id = b.id 
        AND b.code = $1 
        AND ba.user_id = $2 
        AND ba.chama_id = $3
        AND ba.is_active = true
    `,
      [badgeCode, userId, chamaId],
    );
  }

  /**
   * Get all badges awarded to a user
   */
  async getUserBadges(userId: string, chamaId?: string): Promise<BadgeAward[]> {
    let query = `
      SELECT ba.*, 
        b.code, b.name, b.description, b.tier, b.icon_url, b.points_required
      FROM badge_awards ba
      JOIN badges b ON ba.badge_id = b.id
      WHERE ba.user_id = $1 AND ba.is_active = true
    `;

    const params: any[] = [userId];

    if (chamaId) {
      query += ` AND ba.chama_id = $2`;
      params.push(chamaId);
    }

    query += ` ORDER BY ba.awarded_at DESC`;

    const result = await this.db.query(query, params);

    return result.rows.map((row) => this.mapBadgeAwardWithBadge(row));
  }

  /**
   * Get all available badges
   */
  async getAllBadges(): Promise<Badge[]> {
    const result = await this.db.query(
      `SELECT * FROM badges WHERE is_active = true ORDER BY points_required, tier`,
    );

    return result.rows.map((row) => this.mapBadge(row));
  }

  /**
   * Get badge by code
   */
  async getBadgeByCode(code: string): Promise<Badge | null> {
    const result = await this.db.query(`SELECT * FROM badges WHERE code = $1`, [
      code,
    ]);

    if (result.rows.length === 0) return null;
    return this.mapBadge(result.rows[0]);
  }

  /**
   * Get user badge summary
   */
  async getUserBadgeSummary(userId: string, chamaId: string) {
    const result = await this.db.query(
      `SELECT * FROM user_badges_summary WHERE user_id = $1 AND chama_id = $2`,
      [userId, chamaId],
    );

    if (result.rows.length === 0) {
      return {
        totalBadges: 0,
        bronzeBadges: 0,
        silverBadges: 0,
        goldBadges: 0,
        platinumBadges: 0,
        diamondBadges: 0,
        lastBadgeAwardedAt: null,
      };
    }

    return {
      totalBadges: result.rows[0].total_badges,
      bronzeBadges: result.rows[0].bronze_badges,
      silverBadges: result.rows[0].silver_badges,
      goldBadges: result.rows[0].gold_badges,
      platinumBadges: result.rows[0].platinum_badges,
      diamondBadges: result.rows[0].diamond_badges,
      lastBadgeAwardedAt: result.rows[0].last_badge_awarded_at,
    };
  }

  /**
   * Map database row to Badge object
   */
  private mapBadge(row: any): Badge {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      tier: row.tier,
      iconUrl: row.icon_url,
      pointsRequired: row.points_required,
      criteria: row.criteria,
      isActive: row.is_active,
    };
  }

  /**
   * Alias for checkAndAwardBadges (for consistency)
   */
  async evaluateAndAwardBadges(userId: string, chamaId: string): Promise<void> {
    return this.checkAndAwardBadges(userId, chamaId);
  }

  /**
   * Map database row to BadgeAward object
   */
  private mapBadgeAward(row: any): BadgeAward {
    return {
      id: row.id,
      badgeId: row.badge_id,
      userId: row.user_id,
      chamaId: row.chama_id,
      awardedAt: row.awarded_at,
      revokedAt: row.revoked_at,
      isActive: row.is_active,
      awardReason: row.award_reason,
      awardedBySystem: row.awarded_by_system,
    };
  }

  /**
   * Map database row with badge data to BadgeAward object
   */
  private mapBadgeAwardWithBadge(row: any): BadgeAward {
    const award = this.mapBadgeAward(row);
    award.badge = {
      id: row.badge_id,
      code: row.code,
      name: row.name,
      description: row.description,
      tier: row.tier,
      iconUrl: row.icon_url,
      pointsRequired: row.points_required,
      criteria: row.criteria,
      isActive: true,
    };
    return award;
  }
}
