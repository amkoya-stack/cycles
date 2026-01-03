import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from '../wallet/notification.service';

export enum LoanReminderType {
  BEFORE_DUE = 'before_due',
  DUE_DATE = 'due_date',
  OVERDUE = 'overdue',
}

export enum LoanReminderChannel {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
}

@Injectable()
export class LoanReminderService {
  private readonly logger = new Logger(LoanReminderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Main cron job - runs daily at 9 AM to process loan payment reminders
   */
  @Cron('0 9 * * *', {
    name: 'process-loan-payment-reminders',
    timeZone: 'Africa/Nairobi',
  })
  async processReminders() {
    this.logger.log('Starting daily loan payment reminder processing...');

    try {
      // Process all pending reminders that are due
      await this.processPendingReminders();

      // Schedule new reminders for active loans
      await this.scheduleNewReminders();

      // Check for overdue repayments and mark them
      await this.checkAndMarkOverdue();

      this.logger.log('Loan payment reminder processing completed successfully');
    } catch (error) {
      this.logger.error('Error processing loan payment reminders:', error);
    }
  }

  /**
   * Process all pending reminders that are scheduled for today or earlier
   */
  private async processPendingReminders() {
    const pendingReminders = await this.db.query(
      `SELECT 
        r.*,
        l.chama_id,
        l.borrower_id,
        l.principal_amount,
        l.total_amount,
        l.outstanding_balance,
        lr.due_date,
        lr.installment_number,
        lr.amount_due,
        lr.amount_paid,
        lr.status as repayment_status,
        ch.name as chama_name,
        u.full_name,
        u.email,
        u.phone
      FROM loan_repayment_reminders r
      JOIN loans l ON r.loan_id = l.id
      JOIN loan_repayments lr ON r.repayment_id = lr.id
      JOIN chamas ch ON l.chama_id = ch.id
      JOIN users u ON l.borrower_id = u.id
      WHERE r.status = 'pending'
        AND r.scheduled_at <= NOW()
        AND l.status = 'active'
        AND lr.status IN ('pending', 'overdue', 'partial')
      ORDER BY r.scheduled_at ASC
      LIMIT 500`, // Process in batches
    );

    this.logger.log(
      `Found ${pendingReminders.rowCount} pending loan payment reminders to process`,
    );

    for (const reminder of pendingReminders.rows) {
      try {
        // Skip if repayment is already paid
        if (reminder.repayment_status === 'paid') {
          await this.db.query(
            `UPDATE loan_repayment_reminders 
             SET status = 'skipped', updated_at = NOW()
             WHERE id = $1`,
            [reminder.id],
          );
          continue;
        }

        await this.sendReminder(reminder);

        // Mark as sent
        await this.db.query(
          `UPDATE loan_repayment_reminders 
           SET status = 'sent', sent_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [reminder.id],
        );
      } catch (error) {
        this.logger.error(
          `Failed to send loan payment reminder ${reminder.id}:`,
          error.message,
        );

        // Mark as failed
        await this.db.query(
          `UPDATE loan_repayment_reminders 
           SET status = 'failed', failed_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [error.message, reminder.id],
        );
      }
    }
  }

  /**
   * Schedule new reminders for active loans with pending repayments
   */
  private async scheduleNewReminders() {
    // Get active loans with pending/overdue repayments
    const activeLoans = await this.db.query(
      `SELECT DISTINCT l.id, l.chama_id, l.borrower_id, c.settings
       FROM loans l
       JOIN chamas c ON l.chama_id = c.id
       WHERE l.status = 'active'
         AND EXISTS (
           SELECT 1 FROM loan_repayments lr
           WHERE lr.loan_id = l.id
             AND lr.status IN ('pending', 'overdue', 'partial')
         )`,
    );

    for (const loan of activeLoans.rows) {
      await this.scheduleRemindersForLoan(loan.id, loan.settings);
    }
  }

  /**
   * Schedule all reminder types for a loan's pending repayments
   */
  async scheduleRemindersForLoan(loanId: string, chamaSettings?: any) {
    // Get loan and pending repayments
    const loanResult = await this.db.query(
      `SELECT l.*, c.settings
       FROM loans l
       JOIN chamas c ON l.chama_id = c.id
       WHERE l.id = $1 AND l.status = 'active'`,
      [loanId],
    );

    if (loanResult.rowCount === 0) {
      return;
    }

    const loan = loanResult.rows[0];
    const settings = chamaSettings || loan.settings || {};

    // Get reminder configuration from chama settings
    const reminderDaysBefore = settings.loanReminderDaysBefore || [3, 1]; // Default: 3 days and 1 day before
    const reminderChannels = settings.loanReminderChannels || ['email', 'sms']; // Default channels

    // Get pending repayments
    const repayments = await this.db.query(
      `SELECT * FROM loan_repayments
       WHERE loan_id = $1
         AND status IN ('pending', 'overdue', 'partial')
         AND due_date >= CURRENT_DATE - INTERVAL '7 days' -- Only schedule for upcoming or recent
       ORDER BY due_date ASC`,
      [loanId],
    );

    for (const repayment of repayments.rows) {
      const dueDate = new Date(repayment.due_date);
      const now = new Date();

      // Skip if already paid
      if (repayment.status === 'paid') {
        continue;
      }

      // Schedule "before due" reminders
      for (const daysBefore of reminderDaysBefore) {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);

        // Only schedule if reminder date is in the future or today
        if (reminderDate <= now && dueDate >= now) {
          for (const channel of reminderChannels) {
            await this.createReminderIfNotExists(
              loanId,
              repayment.id,
              loan.chama_id,
              loan.borrower_id,
              LoanReminderType.BEFORE_DUE,
              channel,
              reminderDate,
            );
          }
        }
      }

      // Schedule "due date" reminder
      if (dueDate >= now) {
        for (const channel of reminderChannels) {
          await this.createReminderIfNotExists(
            loanId,
            repayment.id,
            loan.chama_id,
            loan.borrower_id,
            LoanReminderType.DUE_DATE,
            channel,
            dueDate,
          );
        }
      }

      // Schedule "overdue" reminders (daily after due date)
      if (dueDate < now && repayment.status !== 'paid') {
        // Schedule overdue reminder for today if not already sent
        for (const channel of reminderChannels) {
          await this.createReminderIfNotExists(
            loanId,
            repayment.id,
            loan.chama_id,
            loan.borrower_id,
            LoanReminderType.OVERDUE,
            channel,
            now,
          );
        }
      }
    }
  }

  /**
   * Create reminder if it doesn't already exist
   */
  private async createReminderIfNotExists(
    loanId: string,
    repaymentId: string,
    chamaId: string,
    borrowerId: string,
    reminderType: LoanReminderType,
    channel: string,
    scheduledAt: Date,
  ) {
    // Check if reminder already exists
    const existing = await this.db.query(
      `SELECT id FROM loan_repayment_reminders
       WHERE loan_id = $1
         AND repayment_id = $2
         AND reminder_type = $3
         AND channel = $4
         AND scheduled_at::date = $5::date`,
      [loanId, repaymentId, reminderType, channel, scheduledAt],
    );

    if (existing.rowCount === 0) {
      const daysOffset =
        reminderType === LoanReminderType.BEFORE_DUE
          ? Math.ceil(
              (scheduledAt.getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : reminderType === LoanReminderType.OVERDUE
            ? -Math.ceil(
                (new Date().getTime() - scheduledAt.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0;

      await this.db.query(
        `INSERT INTO loan_repayment_reminders (
          loan_id, repayment_id, chama_id, borrower_id,
          reminder_type, days_offset, channel, scheduled_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
        [
          loanId,
          repaymentId,
          chamaId,
          borrowerId,
          reminderType,
          daysOffset,
          channel,
          scheduledAt,
        ],
      );
    }
  }

  /**
   * Check for overdue repayments and mark them
   */
  private async checkAndMarkOverdue() {
    const result = await this.db.query(
      `UPDATE loan_repayments lr
       SET status = 'overdue', updated_at = NOW()
       FROM loans l
       WHERE lr.loan_id = l.id
         AND lr.status = 'pending'
         AND lr.due_date < CURRENT_DATE
         AND l.status = 'active'
         AND lr.amount_paid < lr.amount_due
       RETURNING lr.id`,
    );

    if (result.rowCount > 0) {
      this.logger.log(
        `Marked ${result.rowCount} repayments as overdue`,
      );
    }
  }

  /**
   * Send reminder notification via appropriate channel
   */
  private async sendReminder(reminder: any) {
    const message = this.generateReminderMessage(reminder);

    switch (reminder.channel) {
      case LoanReminderChannel.SMS:
        await this.sendSMSReminder(reminder.phone, message);
        break;

      case LoanReminderChannel.EMAIL:
        await this.sendEmailReminder(
          reminder.email,
          reminder.full_name,
          message,
          reminder,
        );
        break;

      case LoanReminderChannel.PUSH:
        await this.sendPushReminder(reminder.borrower_id, message, reminder);
        break;

      case LoanReminderChannel.WHATSAPP:
        await this.sendWhatsAppReminder(reminder.phone, message);
        break;

      default:
        this.logger.warn(`Unknown reminder channel: ${reminder.channel}`);
    }

    this.logger.log(
      `Sent ${reminder.reminder_type} loan payment reminder via ${reminder.channel} to ${reminder.full_name}`,
    );
  }

  /**
   * Generate reminder message based on type
   */
  private generateReminderMessage(reminder: any): string {
    const dueDate = new Date(reminder.due_date);
    const now = new Date();
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysOverdue = Math.abs(daysUntilDue);

    const amountDue = parseFloat(reminder.amount_due) - parseFloat(reminder.amount_paid || 0);

    switch (reminder.reminder_type) {
      case LoanReminderType.BEFORE_DUE:
        return `Hi ${reminder.full_name}, reminder: Your loan payment of KES ${amountDue.toFixed(2)} for ${reminder.chama_name} (Installment #${reminder.installment_number}) is due in ${daysUntilDue} day(s). Make payment to avoid late fees.`;

      case LoanReminderType.DUE_DATE:
        return `Hi ${reminder.full_name}, your loan payment of KES ${amountDue.toFixed(2)} for ${reminder.chama_name} (Installment #${reminder.installment_number}) is due TODAY. Please make payment before end of day to avoid late fees.`;

      case LoanReminderType.OVERDUE:
        return `Hi ${reminder.full_name}, your loan payment of KES ${amountDue.toFixed(2)} for ${reminder.chama_name} (Installment #${reminder.installment_number}) is ${daysOverdue} day(s) OVERDUE. Late fees may apply. Please make payment immediately.`;

      default:
        return `Hi ${reminder.full_name}, reminder to make your loan payment for ${reminder.chama_name}.`;
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

    const subject = `Loan Payment Reminder - ${reminder.chama_name}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #083232;">Loan Payment Reminder</h2>
        <p>Hi ${fullName},</p>
        <p>${message}</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Loan Details:</strong></p>
          <p style="margin: 5px 0;">Chama: ${reminder.chama_name}</p>
          <p style="margin: 5px 0;">Installment: #${reminder.installment_number}</p>
          <p style="margin: 5px 0;">Amount Due: KES ${(parseFloat(reminder.amount_due) - parseFloat(reminder.amount_paid || 0)).toFixed(2)}</p>
          <p style="margin: 5px 0;">Due Date: ${new Date(reminder.due_date).toLocaleDateString()}</p>
        </div>
        <p>Please log in to your account to make the payment.</p>
        <p>Best regards,<br>Cycle Platform</p>
      </div>
    `;

    await this.notification.sendEmail({
      to: email,
      subject: subject,
      html: htmlBody,
    });
  }

  /**
   * Send push notification reminder
   */
  private async sendPushReminder(
    userId: string,
    message: string,
    reminder: any,
  ) {
    try {
      const title = `Loan Payment Reminder - ${reminder.chama_name}`;
      const amountDue =
        parseFloat(reminder.amount_due) -
        parseFloat(reminder.amount_paid || 0);

      await this.notification.sendPushNotification(userId, {
        title,
        body: message,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          type: 'loan_reminder',
          loanId: reminder.loan_id,
          repaymentId: reminder.repayment_id,
          chamaId: reminder.chama_id,
          amountDue: amountDue.toFixed(2),
          dueDate: reminder.due_date,
          installmentNumber: reminder.installment_number,
        },
        tag: `loan-reminder-${reminder.loan_id}-${reminder.installment_number}`,
        requireInteraction: true,
      });

      this.logger.log(`Push reminder sent to user ${userId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send push reminder: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send WhatsApp reminder
   */
  private async sendWhatsAppReminder(phone: string, message: string) {
    if (!phone) {
      this.logger.warn('No phone number available for WhatsApp reminder');
      return;
    }

    // TODO: Implement WhatsApp integration
    this.logger.log(`WhatsApp reminder to ${phone}: ${message}`);
  }
}

