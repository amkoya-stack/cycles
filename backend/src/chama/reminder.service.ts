import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from '../wallet/notification.service';

export enum ReminderType {
  BEFORE_DUE = 'before_due',
  DUE_DATE = 'due_date',
  OVERDUE = 'overdue',
}

export enum ReminderChannel {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Main cron job - runs daily at 9 AM to process reminders
   */
  @Cron('0 9 * * *', {
    name: 'process-contribution-reminders',
    timeZone: 'Africa/Nairobi',
  })
  async processReminders() {
    this.logger.log('Starting daily reminder processing...');

    try {
      // Process all pending reminders that are due
      await this.processPendingReminders();

      // Schedule new reminders for active cycles
      await this.scheduleNewReminders();

      this.logger.log('Reminder processing completed successfully');
    } catch (error) {
      this.logger.error('Error processing reminders:', error);
    }
  }

  /**
   * Process all pending reminders that are scheduled for today or earlier
   */
  private async processPendingReminders() {
    const pendingReminders = await this.db.query(
      `SELECT 
        r.*,
        c.chama_id,
        c.due_date,
        c.cycle_number,
        c.expected_amount,
        ch.name as chama_name,
        u.full_name,
        u.email,
        u.phone,
        cm.total_contributed
      FROM contribution_reminders r
      JOIN contribution_cycles c ON r.cycle_id = c.id
      JOIN chamas ch ON c.chama_id = ch.id
      JOIN chama_members cm ON r.member_id = cm.id
      JOIN users u ON cm.user_id = u.id
      WHERE r.status = 'pending'
        AND r.scheduled_at <= NOW()
        AND c.status = 'active'
      ORDER BY r.scheduled_at ASC
      LIMIT 500`, // Process in batches
    );

    this.logger.log(
      `Found ${pendingReminders.rowCount} pending reminders to process`,
    );

    for (const reminder of pendingReminders.rows) {
      try {
        await this.sendReminder(reminder);

        // Mark as sent
        await this.db.query(
          `UPDATE contribution_reminders 
           SET status = 'sent', sent_at = NOW()
           WHERE id = $1`,
          [reminder.id],
        );
      } catch (error) {
        this.logger.error(
          `Failed to send reminder ${reminder.id}:`,
          error.message,
        );

        // Mark as failed
        await this.db.query(
          `UPDATE contribution_reminders 
           SET status = 'failed'
           WHERE id = $1`,
          [reminder.id],
        );
      }
    }
  }

  /**
   * Schedule new reminders for active cycles
   */
  private async scheduleNewReminders() {
    const activeCycles = await this.db.query(
      `SELECT * FROM contribution_cycles 
       WHERE status = 'active' 
         AND due_date > NOW()`,
    );

    for (const cycle of activeCycles.rows) {
      await this.scheduleRemindersForCycle(cycle.id);
    }
  }

  /**
   * Schedule all reminder types for a cycle's members
   */
  async scheduleRemindersForCycle(cycleId: string) {
    const cycle = await this.db.query(
      `SELECT * FROM contribution_cycles WHERE id = $1`,
      [cycleId],
    );

    if (cycle.rowCount === 0) {
      return;
    }

    const cycleData = cycle.rows[0];
    const dueDate = new Date(cycleData.due_date);
    const now = new Date();

    // Get active members who haven't contributed yet
    const members = await this.db.query(
      `SELECT cm.id, cm.user_id 
       FROM chama_members cm
       WHERE cm.chama_id = $1 
         AND cm.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM contributions co
           WHERE co.cycle_id = $2 AND co.member_id = cm.id AND co.status = 'completed'
         )`,
      [cycleData.chama_id, cycleId],
    );

    // Get chama reminder settings
    const chamaSettings = await this.db.query(
      `SELECT settings FROM chamas WHERE id = $1`,
      [cycleData.chama_id],
    );

    const settings = chamaSettings.rows[0]?.settings || {};
    const reminderChannels = settings.reminder_channels || ['sms', 'email'];
    const reminderDaysBefore = settings.reminder_days_before || [3, 1]; // Default: 3 days and 1 day before

    for (const member of members.rows) {
      // Schedule "before due" reminders
      for (const daysBefore of reminderDaysBefore) {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);
        reminderDate.setHours(9, 0, 0, 0); // 9 AM

        if (reminderDate > now) {
          for (const channel of reminderChannels) {
            await this.createReminderIfNotExists(
              cycleId,
              member.id,
              ReminderType.BEFORE_DUE,
              channel,
              reminderDate,
            );
          }
        }
      }

      // Schedule "due date" reminder
      const dueDateReminder = new Date(dueDate);
      dueDateReminder.setHours(9, 0, 0, 0); // 9 AM on due date

      if (dueDateReminder > now) {
        for (const channel of reminderChannels) {
          await this.createReminderIfNotExists(
            cycleId,
            member.id,
            ReminderType.DUE_DATE,
            channel,
            dueDateReminder,
          );
        }
      }

      // Schedule overdue reminders (1, 3, 7 days after)
      const overdueSchedule = [1, 3, 7];
      for (const daysAfter of overdueSchedule) {
        const overdueDate = new Date(dueDate);
        overdueDate.setDate(overdueDate.getDate() + daysAfter);
        overdueDate.setHours(9, 0, 0, 0);

        if (overdueDate > now) {
          for (const channel of reminderChannels) {
            await this.createReminderIfNotExists(
              cycleId,
              member.id,
              ReminderType.OVERDUE,
              channel,
              overdueDate,
            );
          }
        }
      }
    }

    this.logger.log(
      `Scheduled reminders for cycle ${cycleId} with ${members.rowCount} members`,
    );
  }

  /**
   * Create reminder if it doesn't already exist
   */
  private async createReminderIfNotExists(
    cycleId: string,
    memberId: string,
    reminderType: ReminderType,
    channel: string,
    scheduledAt: Date,
  ) {
    const existing = await this.db.query(
      `SELECT id FROM contribution_reminders
       WHERE cycle_id = $1 
         AND member_id = $2 
         AND reminder_type = $3 
         AND channel = $4`,
      [cycleId, memberId, reminderType, channel],
    );

    if (existing.rowCount === 0) {
      await this.db.query(
        `INSERT INTO contribution_reminders (
          cycle_id, member_id, reminder_type, channel, scheduled_at, status
        ) VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [cycleId, memberId, reminderType, channel, scheduledAt],
      );
    }
  }

  /**
   * Send reminder notification via appropriate channel
   */
  private async sendReminder(reminder: any) {
    const message = this.generateReminderMessage(reminder);

    switch (reminder.channel) {
      case ReminderChannel.SMS:
        await this.sendSMSReminder(reminder.phone, message);
        break;

      case ReminderChannel.EMAIL:
        await this.sendEmailReminder(reminder.email, reminder.full_name, message, reminder);
        break;

      case ReminderChannel.PUSH:
        await this.sendPushReminder(reminder.user_id, message);
        break;

      case ReminderChannel.WHATSAPP:
        await this.sendWhatsAppReminder(reminder.phone, message);
        break;

      default:
        this.logger.warn(`Unknown reminder channel: ${reminder.channel}`);
    }

    this.logger.log(
      `Sent ${reminder.reminder_type} reminder via ${reminder.channel} to ${reminder.full_name}`,
    );
  }

  /**
   * Generate reminder message based on type
   */
  private generateReminderMessage(reminder: any): string {
    const daysUntilDue = Math.ceil(
      (new Date(reminder.due_date).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const amount = parseFloat(reminder.expected_amount);

    switch (reminder.reminder_type) {
      case ReminderType.BEFORE_DUE:
        return `Hi ${reminder.full_name}, reminder: Your contribution of KES ${amount.toFixed(2)} for ${reminder.chama_name} Cycle ${reminder.cycle_number} is due in ${daysUntilDue} days. Contribute now to avoid late penalties.`;

      case ReminderType.DUE_DATE:
        return `Hi ${reminder.full_name}, your contribution of KES ${amount.toFixed(2)} for ${reminder.chama_name} Cycle ${reminder.cycle_number} is due TODAY. Please contribute before end of day to avoid penalties.`;

      case ReminderType.OVERDUE:
        const daysOverdue = Math.abs(daysUntilDue);
        return `Hi ${reminder.full_name}, your contribution of KES ${amount.toFixed(2)} for ${reminder.chama_name} Cycle ${reminder.cycle_number} is ${daysOverdue} day(s) OVERDUE. Late penalties may apply. Please contribute immediately.`;

      default:
        return `Hi ${reminder.full_name}, reminder to contribute to ${reminder.chama_name}.`;
    }
  }

  /**
   * Send SMS reminder
   */
  private async sendSMSReminder(phone: string, message: string) {
    if (!phone) {
      this.logger.warn('No phone number available for SMS reminder');
      return;
    }

    await this.notification.sendSMSReceipt({
      phoneNumber: phone,
      message: message,
    });
  }

  /**
   * Send email reminder
   */
  private async sendEmailReminder(
    email: string,
    fullName: string,
    message: string,
    reminder: any,
  ) {
    if (!email) {
      this.logger.warn('No email available for email reminder');
      return;
    }

    const subject = this.getEmailSubject(reminder);
    const html = this.generateEmailHTML(fullName, message, reminder);

    await this.notification.sendEmail({
      to: email,
      subject: subject,
      html: html,
    });
  }

  /**
   * Get email subject based on reminder type
   */
  private getEmailSubject(reminder: any): string {
    switch (reminder.reminder_type) {
      case ReminderType.BEFORE_DUE:
        return `Upcoming Contribution Due - ${reminder.chama_name}`;
      case ReminderType.DUE_DATE:
        return `⏰ Contribution Due Today - ${reminder.chama_name}`;
      case ReminderType.OVERDUE:
        return `⚠️ OVERDUE Contribution - ${reminder.chama_name}`;
      default:
        return `Contribution Reminder - ${reminder.chama_name}`;
    }
  }

  /**
   * Generate HTML email template
   */
  private generateEmailHTML(
    fullName: string,
    message: string,
    reminder: any,
  ): string {
    const amount = parseFloat(reminder.expected_amount);
    const dueDate = new Date(reminder.due_date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #083232; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .amount { font-size: 28px; font-weight: bold; color: #083232; }
    .button { display: inline-block; background: #f64d52; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${reminder.chama_name}</h2>
      <p>Cycle ${reminder.cycle_number} Contribution Reminder</p>
    </div>
    <div class="content">
      <p>Hi ${fullName},</p>
      <p>${message}</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="color: #666; font-size: 14px; margin-bottom: 10px;">Amount Due</div>
        <div class="amount">KES ${amount.toFixed(2)}</div>
        <div style="color: #666; font-size: 14px; margin-top: 10px;">Due Date: ${dueDate}</div>
      </div>

      ${
        reminder.reminder_type === ReminderType.OVERDUE
          ? `
      <div class="warning">
        <strong>⚠️ Late Payment Penalty:</strong> Penalties may be calculated based on days overdue according to your chama's settings.
      </div>
      `
          : ''
      }

      <div style="text-align: center;">
        <a href="https://cycle.app/contribute" class="button">Contribute Now</a>
      </div>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        You can contribute via:
        <ul>
          <li>Wallet (instant)</li>
          <li>M-Pesa STK Push</li>
          <li>Setup Auto-Debit for future cycles</li>
        </ul>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated reminder from Cycle Platform</p>
      <p>To manage your notification preferences, log in to your account</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Send push notification reminder
   */
  private async sendPushReminder(userId: string, message: string) {
    // TODO: Implement push notification via Firebase Cloud Messaging
    this.logger.log(`Push notification to user ${userId}: ${message}`);
  }

  /**
   * Send WhatsApp reminder
   */
  private async sendWhatsAppReminder(phone: string, message: string) {
    // TODO: Implement WhatsApp Business API integration
    this.logger.log(`WhatsApp message to ${phone}: ${message}`);
  }

  /**
   * Manual trigger for immediate reminder scheduling (can be called via API)
   */
  async scheduleRemindersForNewCycle(cycleId: string) {
    this.logger.log(`Manually scheduling reminders for cycle ${cycleId}`);
    await this.scheduleRemindersForCycle(cycleId);
  }

  /**
   * Cancel all pending reminders for a member who has contributed
   */
  async cancelRemindersForMember(cycleId: string, memberId: string) {
    await this.db.query(
      `UPDATE contribution_reminders 
       SET status = 'cancelled'
       WHERE cycle_id = $1 
         AND member_id = $2 
         AND status = 'pending'`,
      [cycleId, memberId],
    );

    this.logger.log(
      `Cancelled pending reminders for member ${memberId} in cycle ${cycleId}`,
    );
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats(chamaId?: string) {
    const query = chamaId
      ? `SELECT 
          r.status,
          r.reminder_type,
          r.channel,
          COUNT(*) as count
         FROM contribution_reminders r
         JOIN contribution_cycles c ON r.cycle_id = c.id
         WHERE c.chama_id = $1
         GROUP BY r.status, r.reminder_type, r.channel
         ORDER BY r.status, r.reminder_type`
      : `SELECT 
          r.status,
          r.reminder_type,
          r.channel,
          COUNT(*) as count
         FROM contribution_reminders r
         GROUP BY r.status, r.reminder_type, r.channel
         ORDER BY r.status, r.reminder_type`;

    const params = chamaId ? [chamaId] : [];
    const result = await this.db.query(query, params);

    return result.rows;
  }
}
