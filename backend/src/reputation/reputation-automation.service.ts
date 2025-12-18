/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ReputationService } from '../reputation/reputation.service';
import { BadgeService } from '../reputation/badge.service';

@Injectable()
export class ReputationAutomationService {
  private readonly logger = new Logger(ReputationAutomationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly reputationService: ReputationService,
    private readonly badgeService: BadgeService,
  ) {}

  /**
   * Process pending reputation calculation events
   */
  async processPendingEvents(limit = 50): Promise<number> {
    try {
      // Get pending events
      const events = await this.db.query(
        `
        SELECT id, user_id, chama_id, trigger_type, trigger_id
        FROM reputation_calculation_events
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
        [limit],
      );

      if (events.rows.length === 0) {
        return 0;
      }

      let processed = 0;

      for (const event of events.rows) {
        try {
          await this.processEvent(event);
          processed++;
        } catch (error) {
          this.logger.error(
            `Failed to process event ${event.id}: ${error.message}`,
          );
          await this.markEventFailed(event.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      this.logger.error(
        `Failed to process reputation events: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Process a single reputation calculation event
   */
  private async processEvent(event: any): Promise<void> {
    const { id, user_id, chama_id, trigger_type } = event;

    // Mark as processing
    await this.db.query(
      `UPDATE reputation_calculation_events 
       SET status = 'processing' 
       WHERE id = $1`,
      [id],
    );

    // Get score before
    const beforeScore = await this.db.query(
      `SELECT total_score, tier 
       FROM reputation_scores 
       WHERE user_id = $1 AND chama_id = $2`,
      [user_id, chama_id],
    );

    const scoreBefore = beforeScore.rows[0]?.total_score || 0;
    const tierBefore = beforeScore.rows[0]?.tier || 'bronze';

    // Calculate new reputation score
    const newScore = await this.reputationService.calculateUserReputation(
      user_id,
      chama_id,
    );

    // Award any newly earned badges
    await this.badgeService.evaluateAndAwardBadges(user_id, chama_id);

    // Mark as completed
    await this.db.query(
      `UPDATE reputation_calculation_events 
       SET status = 'completed',
           score_before = $1,
           score_after = $2,
           tier_before = $3,
           tier_after = $4,
           processed_at = NOW()
       WHERE id = $5`,
      [scoreBefore, newScore.totalScore, tierBefore, newScore.tier, id],
    );

    this.logger.debug(
      `Processed reputation event ${id} for user ${user_id} in chama ${chama_id}. ` +
        `Score: ${scoreBefore} → ${newScore.totalScore}, Tier: ${tierBefore} → ${newScore.tier}`,
    );
  }

  /**
   * Mark event as failed
   */
  private async markEventFailed(
    eventId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE reputation_calculation_events 
       SET status = 'failed',
           error_message = $1,
           processed_at = NOW()
       WHERE id = $2`,
      [errorMessage, eventId],
    );
  }

  /**
   * Trigger reputation calculation for a user in a chama
   */
  async triggerCalculation(
    userId: string,
    chamaId: string,
    triggerType: string,
    triggerId?: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO reputation_calculation_events 
       (user_id, chama_id, trigger_type, trigger_id, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, chamaId, triggerType, triggerId || null],
    );

    // Process immediately if it's a high-priority trigger
    if (['contribution', 'loan_repayment'].includes(triggerType)) {
      await this.processPendingEvents(1);
    }
  }

  /**
   * Recalculate all reputation scores for a chama
   */
  async recalculateAllForChama(chamaId: string): Promise<number> {
    try {
      // Get all active members
      const members = await this.db.query(
        `SELECT user_id 
         FROM chama_members 
         WHERE chama_id = $1 AND status = 'active'`,
        [chamaId],
      );

      // Queue calculation events for all members
      for (const member of members.rows) {
        await this.triggerCalculation(member.user_id, chamaId, 'manual');
      }

      // Process all events
      return await this.processPendingEvents(members.rows.length);
    } catch (error) {
      this.logger.error(
        `Failed to recalculate reputation for chama ${chamaId}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Scheduled job to process pending events
   */
  async scheduledProcess(): Promise<void> {
    this.logger.log('Running scheduled reputation calculation...');
    const processed = await this.processPendingEvents(100);
    this.logger.log(`Processed ${processed} reputation events`);
  }

  /**
   * Clean up old completed events
   */
  async cleanupOldEvents(daysToKeep = 30): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM reputation_calculation_events
       WHERE status IN ('completed', 'failed')
       AND processed_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysToKeep],
    );

    return result.rowCount;
  }
}
