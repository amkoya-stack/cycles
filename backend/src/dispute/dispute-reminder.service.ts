/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { DisputeNotificationService } from './dispute-notification.service';

@Injectable()
export class DisputeReminderService {
  private readonly logger = new Logger(DisputeReminderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notification: DisputeNotificationService,
  ) {}

  /**
   * Check for disputes with upcoming voting deadlines (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkVotingDeadlines(): Promise<void> {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Find disputes with voting deadlines in the next 24 hours
      const disputes = await this.db.query(
        `SELECT d.*, c.name as chama_name
         FROM disputes d
         JOIN chamas c ON d.chama_id = c.id
         WHERE d.status = 'voting'
           AND d.voting_deadline IS NOT NULL
           AND d.voting_deadline BETWEEN $1 AND $2
           AND d.voting_deadline > CURRENT_TIMESTAMP`,
        [now, oneDayFromNow],
      );

      for (const dispute of disputes.rows) {
        const deadline = new Date(dispute.voting_deadline);
        const hoursUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

        // Send reminder if deadline is within 24 hours and not already reminded in last 2 hours
        if (hoursUntilDeadline <= 24 && hoursUntilDeadline > 0) {
          await this.sendVotingReminder(dispute, hoursUntilDeadline);
        }
      }

      this.logger.log(`Checked ${disputes.rows.length} disputes with upcoming voting deadlines`);
    } catch (error: any) {
      this.logger.error(`Failed to check voting deadlines: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for disputes with upcoming discussion deadlines (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkDiscussionDeadlines(): Promise<void> {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const disputes = await this.db.query(
        `SELECT d.*, c.name as chama_name
         FROM disputes d
         JOIN chamas c ON d.chama_id = c.id
         WHERE d.status = 'discussion'
           AND d.discussion_deadline IS NOT NULL
           AND d.discussion_deadline BETWEEN $1 AND $2
           AND d.discussion_deadline > CURRENT_TIMESTAMP`,
        [now, oneDayFromNow],
      );

      for (const dispute of disputes.rows) {
        const deadline = new Date(dispute.discussion_deadline);
        const hoursUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

        if (hoursUntilDeadline <= 24 && hoursUntilDeadline > 0) {
          await this.sendDiscussionReminder(dispute, hoursUntilDeadline);
        }
      }

      this.logger.log(`Checked ${disputes.rows.length} disputes with upcoming discussion deadlines`);
    } catch (error: any) {
      this.logger.error(`Failed to check discussion deadlines: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for overdue disputes (runs daily)
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkOverdueDisputes(): Promise<void> {
    try {
      const now = new Date();

      // Find disputes with passed deadlines
      const overdueVoting = await this.db.query(
        `SELECT d.*, c.name as chama_name
         FROM disputes d
         JOIN chamas c ON d.chama_id = c.id
         WHERE d.status = 'voting'
           AND d.voting_deadline IS NOT NULL
           AND d.voting_deadline < $1`,
        [now],
      );

      const overdueDiscussion = await this.db.query(
        `SELECT d.*, c.name as chama_name
         FROM disputes d
         JOIN chamas c ON d.chama_id = c.id
         WHERE d.status = 'discussion'
           AND d.discussion_deadline IS NOT NULL
           AND d.discussion_deadline < $1`,
        [now],
      );

      // Notify admins about overdue disputes
      for (const dispute of [...overdueVoting.rows, ...overdueDiscussion.rows]) {
        await this.sendOverdueReminder(dispute);
      }

      this.logger.log(
        `Found ${overdueVoting.rows.length} overdue voting disputes and ${overdueDiscussion.rows.length} overdue discussion disputes`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to check overdue disputes: ${error.message}`, error.stack);
    }
  }

  /**
   * Send voting reminder
   */
  private async sendVotingReminder(dispute: any, hoursUntilDeadline: number): Promise<void> {
    try {
      const members = await this.db.query(
        `SELECT u.id, u.email, u.push_token, u.full_name
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.status = 'active'`,
        [dispute.chama_id],
      );

      const deadlineText = hoursUntilDeadline < 1
        ? 'less than an hour'
        : hoursUntilDeadline === 1
          ? '1 hour'
          : `${hoursUntilDeadline} hours`;

      const subject = `Voting Deadline Reminder: ${dispute.title}`;
      const message = `The voting deadline for dispute "${dispute.title}" is in ${deadlineText}. Please cast your vote if you haven't already.`;

      for (const member of members.rows) {
        // Check if user has already voted
        const hasVoted = await this.db.query(
          `SELECT id FROM dispute_votes WHERE dispute_id = $1 AND user_id = $2`,
          [dispute.id, member.id],
        );

        if (hasVoted.rows.length === 0) {
          // User hasn't voted, send reminder
          if (member.email) {
            await this.notification['notification'].sendEmail({
              to: member.email,
              subject,
              html: `<p>Dear ${member.full_name},</p><p>${message}</p><p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/disputes/${dispute.id}">Vote Now</a></p>`,
              text: message,
            });
          }

          if (member.id) {
            await this.notification['notification'].sendPushNotification(member.id, {
              title: 'Voting Deadline Reminder',
              body: message,
              requireInteraction: true,
              data: {
                type: 'dispute_vote_reminder',
                disputeId: dispute.id,
                chamaId: dispute.chama_id,
              },
            });
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to send voting reminder: ${error.message}`, error.stack);
    }
  }

  /**
   * Send discussion reminder
   */
  private async sendDiscussionReminder(dispute: any, hoursUntilDeadline: number): Promise<void> {
    try {
      const participants = await this.db.query(
        `SELECT DISTINCT u.id, u.email, u.push_token, u.full_name
         FROM users u
         WHERE u.id = $1 OR u.id = $2
         UNION
         SELECT u.id, u.email, u.push_token, u.full_name
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $3 AND cm.status = 'active'`,
        [dispute.filed_by_user_id, dispute.filed_against_user_id || null, dispute.chama_id],
      );

      const deadlineText = hoursUntilDeadline < 1
        ? 'less than an hour'
        : hoursUntilDeadline === 1
          ? '1 hour'
          : `${hoursUntilDeadline} hours`;

      const subject = `Discussion Deadline Reminder: ${dispute.title}`;
      const message = `The discussion deadline for dispute "${dispute.title}" is in ${deadlineText}. Please add your comments if you have any.`;

      for (const participant of participants.rows) {
        if (participant.email) {
          await this.notification['notification'].sendEmail({
            to: participant.email,
            subject,
            html: `<p>Dear ${participant.full_name},</p><p>${message}</p>`,
            text: message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to send discussion reminder: ${error.message}`, error.stack);
    }
  }

  /**
   * Send overdue reminder to admins
   */
  private async sendOverdueReminder(dispute: any): Promise<void> {
    try {
      const admins = await this.db.query(
        `SELECT u.id, u.email, u.full_name
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.role IN ('admin', 'treasurer') AND cm.status = 'active'`,
        [dispute.chama_id],
      );

      const subject = `Overdue Dispute: ${dispute.title}`;
      const message = `The dispute "${dispute.title}" has passed its deadline. Please take action.`;

      for (const admin of admins.rows) {
        if (admin.email) {
          await this.notification['notification'].sendEmail({
            to: admin.email,
            subject,
            html: `<p>Dear ${admin.full_name},</p><p>${message}</p><p>Dispute ID: ${dispute.id}</p>`,
            text: message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to send overdue reminder: ${error.message}`, error.stack);
    }
  }
}

