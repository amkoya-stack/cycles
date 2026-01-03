/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from '../wallet/notification.service';
import { DisputeStatus, DisputeType } from './dispute.service';

@Injectable()
export class DisputeNotificationService {
  private readonly logger = new Logger(DisputeNotificationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Notify chama members about a new dispute
   */
  async notifyDisputeFiled(dispute: any): Promise<void> {
    try {
      // Get chama members
      const members = await this.db.query(
        `SELECT u.id, u.email, u.phone, u.full_name, u.push_token
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.status = 'active'`,
        [dispute.chamaId],
      );

      const disputeTypeLabel = this.getDisputeTypeLabel(dispute.disputeType);
      const subject = `New Dispute Filed: ${dispute.title}`;
      const message = `A new ${disputeTypeLabel.toLowerCase()} dispute has been filed in your chama: "${dispute.title}". Please review and participate in the resolution process.`;

      // Notify all members
      for (const member of members.rows) {
        // Email notification
        if (member.email) {
          await this.notification.sendEmail({
            to: member.email,
            subject,
            html: this.getDisputeEmailTemplate(dispute, 'filed', member.full_name),
            text: message,
          });
        }

        // Push notification (sendPushNotification expects userId, not token)
        if (member.id) {
          await this.notification.sendPushNotification(member.id, {
            title: 'New Dispute Filed',
            body: message,
            data: {
              type: 'dispute',
              disputeId: dispute.id,
              chamaId: dispute.chamaId,
              action: 'view',
            },
          });
        }
      }

      this.logger.log(`Notified ${members.rows.length} members about dispute ${dispute.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to notify about dispute: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about dispute status change
   */
  async notifyDisputeStatusChange(dispute: any, oldStatus: DisputeStatus): Promise<void> {
    try {
      // Get dispute participants (filed by, filed against, admins)
      const participants = await this.db.query(
        `SELECT DISTINCT u.id, u.email, u.phone, u.full_name, u.push_token
         FROM users u
         WHERE u.id = $1 OR u.id = $2
         UNION
         SELECT u.id, u.email, u.phone, u.full_name, u.push_token
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $3 AND cm.role IN ('admin', 'treasurer') AND cm.status = 'active'`,
        [dispute.filedByUserId, dispute.filedAgainstUserId || null, dispute.chamaId],
      );

      const statusLabel = this.getStatusLabel(dispute.status);
      const subject = `Dispute Status Update: ${dispute.title}`;
      const message = `The dispute "${dispute.title}" status has changed from ${this.getStatusLabel(oldStatus)} to ${statusLabel}.`;

      for (const participant of participants.rows) {
        if (participant.email) {
          await this.notification.sendEmail({
            to: participant.email,
            subject,
            html: this.getDisputeEmailTemplate(dispute, dispute.status, participant.full_name),
            text: message,
          });
        }

        if (participant.id) {
          await this.notification.sendPushNotification(participant.id, {
            title: 'Dispute Status Updated',
            body: message,
            data: {
              type: 'dispute',
              disputeId: dispute.id,
              chamaId: dispute.chamaId,
              status: dispute.status,
            },
          });
        }
      }

      this.logger.log(`Notified participants about dispute ${dispute.id} status change`);
    } catch (error: any) {
      this.logger.error(`Failed to notify about status change: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about new evidence
   */
  async notifyEvidenceAdded(dispute: any, evidence: any, submittedBy: string): Promise<void> {
    try {
      const participants = await this.getDisputeParticipants(dispute);

      const subject = `New Evidence Added to Dispute: ${dispute.title}`;
      const message = `New evidence has been added to the dispute "${dispute.title}". Please review it.`;

      for (const participant of participants) {
        if (participant.email) {
          await this.notification.sendEmail({
            to: participant.email,
            subject,
            html: `<p>Dear ${participant.full_name},</p><p>${message}</p><p>Evidence: ${evidence.title}</p>`,
            text: message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify about evidence: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about new comment
   */
  async notifyCommentAdded(dispute: any, comment: any): Promise<void> {
    try {
      const participants = await this.getDisputeParticipants(dispute);

      const subject = `New Comment on Dispute: ${dispute.title}`;
      const message = `A new comment has been added to the dispute "${dispute.title}".`;

      for (const participant of participants) {
        if (participant.id) {
          await this.notification.sendPushNotification(participant.id, {
            title: 'New Dispute Comment',
            body: message,
            data: {
              type: 'dispute_comment',
              disputeId: dispute.id,
              chamaId: dispute.chamaId,
            },
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify about comment: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about voting phase
   */
  async notifyVotingStarted(dispute: any): Promise<void> {
    try {
      const members = await this.db.query(
        `SELECT u.id, u.email, u.phone, u.full_name, u.push_token
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.status = 'active'`,
        [dispute.chamaId],
      );

      const deadline = dispute.votingDeadline
        ? new Date(dispute.votingDeadline).toLocaleString()
        : 'TBD';
      const subject = `Voting Started: ${dispute.title}`;
      const message = `Voting has started for the dispute "${dispute.title}". Deadline: ${deadline}. Please cast your vote.`;

      for (const member of members.rows) {
        if (member.email) {
          await this.notification.sendEmail({
            to: member.email,
            subject,
            html: this.getDisputeEmailTemplate(dispute, 'voting', member.full_name),
            text: message,
          });
        }

        if (member.id) {
          await this.notification.sendPushNotification(member.id, {
            title: 'Vote on Dispute',
            body: message,
            requireInteraction: true,
            data: {
              type: 'dispute_vote',
              disputeId: dispute.id,
              chamaId: dispute.chamaId,
              deadline: dispute.votingDeadline,
            },
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify about voting: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about dispute resolution
   */
  async notifyDisputeResolved(dispute: any): Promise<void> {
    try {
      const participants = await this.getDisputeParticipants(dispute);

      const resolutionType = this.getResolutionTypeLabel(dispute.resolutionType);
      const subject = `Dispute Resolved: ${dispute.title}`;
      const message = `The dispute "${dispute.title}" has been resolved with resolution: ${resolutionType}.`;

      for (const participant of participants) {
        if (participant.email) {
          await this.notification.sendEmail({
            to: participant.email,
            subject,
            html: this.getDisputeEmailTemplate(dispute, 'resolved', participant.full_name),
            text: message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify about resolution: ${error.message}`, error.stack);
    }
  }

  /**
   * Notify about escalation
   */
  async notifyDisputeEscalated(dispute: any): Promise<void> {
    try {
      // Notify platform admins (would need admin user lookup)
      const admins = await this.db.query(
        `SELECT u.id, u.email, u.full_name
         FROM users u
         WHERE u.role = 'platform_admin' OR u.is_admin = TRUE`,
      );

      const subject = `Dispute Escalated: ${dispute.title}`;
      const message = `A dispute has been escalated to platform review: "${dispute.title}".`;

      for (const admin of admins.rows) {
        if (admin.email) {
          await this.notification.sendEmail({
            to: admin.email,
            subject,
            html: `<p>Dear ${admin.full_name},</p><p>${message}</p><p>Dispute ID: ${dispute.id}</p><p>Chama ID: ${dispute.chamaId}</p>`,
            text: message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to notify about escalation: ${error.message}`, error.stack);
    }
  }

  // Helper methods
  private async getDisputeParticipants(dispute: any): Promise<any[]> {
    const result = await this.db.query(
      `SELECT DISTINCT u.id, u.email, u.phone, u.full_name, u.push_token
       FROM users u
       WHERE u.id = $1 OR u.id = $2
       UNION
       SELECT u.id, u.email, u.phone, u.full_name, u.push_token
       FROM chama_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.chama_id = $3 AND cm.role IN ('admin', 'treasurer') AND cm.status = 'active'`,
      [dispute.filedByUserId, dispute.filedAgainstUserId || null, dispute.chamaId],
    );
    return result.rows;
  }

  private getDisputeTypeLabel(type: DisputeType): string {
    const labels: Record<DisputeType, string> = {
      [DisputeType.PAYMENT_DISPUTE]: 'Payment Dispute',
      [DisputeType.PAYOUT_DISPUTE]: 'Payout Dispute',
      [DisputeType.MEMBERSHIP_DISPUTE]: 'Membership Dispute',
      [DisputeType.LOAN_DEFAULT]: 'Loan Default',
      [DisputeType.RULE_VIOLATION]: 'Rule Violation',
    };
    return labels[type] || type;
  }

  private getStatusLabel(status: DisputeStatus): string {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private getResolutionTypeLabel(type: string): string {
    return type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private getDisputeEmailTemplate(dispute: any, status: string, recipientName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #083232; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cycle Platform</h1>
            <h2>Dispute Notification</h2>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            <p><strong>Dispute:</strong> ${dispute.title}</p>
            <p><strong>Status:</strong> ${this.getStatusLabel(status as DisputeStatus)}</p>
            <p><strong>Type:</strong> ${this.getDisputeTypeLabel(dispute.disputeType)}</p>
            ${dispute.description ? `<p><strong>Description:</strong> ${dispute.description}</p>` : ''}
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/disputes/${dispute.id}">View Dispute</a></p>
          </div>
          <div class="footer">
            <p>Thank you for using Cycle Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

