import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { ContributionService } from './contribution.service';
import { NotificationService } from '../wallet/notification.service';
import { PaymentMethod } from './dto/contribution.dto';

export enum AutoDebitStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  NO_ACTIVE_CYCLE = 'no_active_cycle',
  ALREADY_CONTRIBUTED = 'already_contributed',
}

@Injectable()
export class AutoDebitService {
  private readonly logger = new Logger(AutoDebitService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_HOURS = 6;

  constructor(
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => ContributionService))
    private readonly contributionService: ContributionService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Main cron job - runs daily at midnight to process auto-debits
   */
  @Cron('0 0 * * *', {
    name: 'process-auto-debits',
    timeZone: 'Africa/Nairobi',
  })
  async processAutoDebits() {
    this.logger.log('Starting daily auto-debit processing...');

    try {
      const processedCount = await this.processDueAutoDebits();
      const retriedCount = await this.retryFailedAutoDebits();

      this.logger.log(
        `Auto-debit processing completed: ${processedCount} processed, ${retriedCount} retried`,
      );
    } catch (error) {
      this.logger.error('Error processing auto-debits:', error);
    }
  }

  /**
   * Process all auto-debits that are due today
   */
  async processDueAutoDebits(): Promise<number> {
    const dueAutoDebits = await this.db.query(
      `SELECT 
        ad.*,
        cm.user_id,
        cm.chama_id,
        ch.name as chama_name,
        u.full_name,
        u.email,
        u.phone
      FROM contribution_auto_debits ad
      JOIN chama_members cm ON ad.member_id = cm.id
      JOIN chamas ch ON cm.chama_id = ch.id
      JOIN users u ON cm.user_id = u.id
      WHERE ad.enabled = true
        AND ad.next_execution_at <= NOW()
        AND cm.status = 'active'
      ORDER BY ad.next_execution_at ASC
      LIMIT 200`, // Process in batches
    );

    this.logger.log(
      `Found ${dueAutoDebits.rowCount} auto-debits due for processing`,
    );

    let processedCount = 0;

    for (const autoDebit of dueAutoDebits.rows) {
      try {
        await this.executeAutoDebit(autoDebit);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to execute auto-debit ${autoDebit.id}:`,
          error.message,
        );
        await this.recordAutoDebitFailure(autoDebit.id, error.message);
      }
    }

    return processedCount;
  }

  /**
   * Retry failed auto-debits that are eligible for retry
   */
  async retryFailedAutoDebits(): Promise<number> {
    const failedAutoDebits = await this.db.query(
      `SELECT 
        ad.*,
        cm.user_id,
        cm.chama_id,
        ch.name as chama_name,
        u.full_name,
        u.email,
        u.phone
      FROM contribution_auto_debits ad
      JOIN chama_members cm ON ad.member_id = cm.id
      JOIN chamas ch ON cm.chama_id = ch.id
      JOIN users u ON cm.user_id = u.id
      WHERE ad.enabled = true
        AND ad.last_execution_status = 'failed'
        AND ad.retry_count < $1
        AND ad.last_execution_at <= NOW() - INTERVAL '${this.RETRY_DELAY_HOURS} hours'
        AND cm.status = 'active'
      LIMIT 100`,
      [this.MAX_RETRIES],
    );

    this.logger.log(
      `Found ${failedAutoDebits.rowCount} failed auto-debits eligible for retry`,
    );

    let retriedCount = 0;

    for (const autoDebit of failedAutoDebits.rows) {
      try {
        await this.executeAutoDebit(autoDebit, true);
        retriedCount++;
      } catch (error) {
        this.logger.error(
          `Retry failed for auto-debit ${autoDebit.id}:`,
          error.message,
        );
        await this.recordAutoDebitFailure(autoDebit.id, error.message, true);
      }
    }

    return retriedCount;
  }

  /**
   * Execute a single auto-debit
   */
  private async executeAutoDebit(autoDebit: any, isRetry: boolean = false) {
    this.logger.log(
      `${isRetry ? 'Retrying' : 'Executing'} auto-debit ${autoDebit.id} for user ${autoDebit.user_id}`,
    );

    // Get active cycle for the chama
    const activeCycle = await this.db.query(
      `SELECT * FROM contribution_cycles 
       WHERE chama_id = $1 AND status = 'active'
       ORDER BY cycle_number DESC LIMIT 1`,
      [autoDebit.chama_id],
    );

    if (activeCycle.rowCount === 0) {
      await this.updateAutoDebitStatus(
        autoDebit.id,
        AutoDebitStatus.NO_ACTIVE_CYCLE,
        'No active cycle found',
      );
      this.logger.warn(
        `No active cycle for chama ${autoDebit.chama_id}, skipping auto-debit`,
      );
      return;
    }

    const cycle = activeCycle.rows[0];

    // Check if already contributed to this cycle
    const existingContribution = await this.db.query(
      `SELECT id FROM contributions 
       WHERE cycle_id = $1 AND user_id = $2 AND status = 'completed'`,
      [cycle.id, autoDebit.user_id],
    );

    if (existingContribution.rowCount > 0) {
      await this.updateAutoDebitStatus(
        autoDebit.id,
        AutoDebitStatus.ALREADY_CONTRIBUTED,
        'Already contributed to this cycle',
      );
      this.logger.log(
        `User ${autoDebit.user_id} already contributed to cycle ${cycle.id}`,
      );
      // Schedule next execution
      await this.scheduleNextExecution(autoDebit);
      return;
    }

    // Determine contribution amount
    const amount =
      autoDebit.amount_type === 'fixed'
        ? parseFloat(autoDebit.fixed_amount)
        : parseFloat(cycle.expected_amount);

    // Create contribution via ContributionService
    try {
      const contribution = await this.contributionService.createContribution(
        autoDebit.user_id,
        {
          chamaId: autoDebit.chama_id,
          cycleId: cycle.id,
          amount: amount,
          paymentMethod:
            autoDebit.payment_method === 'mpesa_direct'
              ? PaymentMethod.MPESA_DIRECT
              : PaymentMethod.WALLET,
          mpesaPhone: autoDebit.mpesa_phone,
          notes: `Auto-debit contribution for cycle ${cycle.cycle_number}`,
        },
      );

      // Update auto-debit as successful
      await this.updateAutoDebitStatus(
        autoDebit.id,
        AutoDebitStatus.SUCCESS,
        null,
      );

      // Schedule next execution
      await this.scheduleNextExecution(autoDebit);

      // Send success notification
      await this.sendSuccessNotification(autoDebit, contribution, cycle);

      this.logger.log(
        `Auto-debit ${autoDebit.id} executed successfully: ${contribution.contributionId}`,
      );
    } catch (error: any) {
      let status = AutoDebitStatus.FAILED;
      let errorMessage = error.message;

      // Check if it's insufficient balance error
      if (
        error.message.includes('Insufficient balance') ||
        error.message.includes('insufficient')
      ) {
        status = AutoDebitStatus.INSUFFICIENT_BALANCE;
      }

      await this.updateAutoDebitStatus(autoDebit.id, status, errorMessage);

      // Send failure notification
      await this.sendFailureNotification(autoDebit, cycle, errorMessage);

      throw error; // Re-throw for retry logic
    }
  }

  /**
   * Update auto-debit execution status
   */
  private async updateAutoDebitStatus(
    autoDebitId: string,
    status: AutoDebitStatus,
    errorMessage: string | null,
  ) {
    await this.db.query(
      `UPDATE contribution_auto_debits 
       SET last_execution_at = NOW(),
           last_execution_status = $2,
           last_execution_error = $3,
           retry_count = CASE 
             WHEN $2 = 'success' THEN 0 
             ELSE retry_count 
           END
       WHERE id = $1`,
      [autoDebitId, status, errorMessage],
    );
  }

  /**
   * Record auto-debit failure and increment retry count
   */
  private async recordAutoDebitFailure(
    autoDebitId: string,
    errorMessage: string,
    isRetry: boolean = false,
  ) {
    await this.db.query(
      `UPDATE contribution_auto_debits 
       SET last_execution_at = NOW(),
           last_execution_status = 'failed',
           last_execution_error = $2,
           retry_count = retry_count + 1
       WHERE id = $1`,
      [autoDebitId, errorMessage],
    );

    // Check if max retries exceeded
    const autoDebit = await this.db.query(
      `SELECT * FROM contribution_auto_debits WHERE id = $1`,
      [autoDebitId],
    );

    if (autoDebit.rows[0].retry_count >= this.MAX_RETRIES) {
      this.logger.warn(
        `Auto-debit ${autoDebitId} exceeded max retries, disabling`,
      );
      await this.db.query(
        `UPDATE contribution_auto_debits 
         SET enabled = false,
             disabled_reason = 'Max retries exceeded after failures'
         WHERE id = $1`,
        [autoDebitId],
      );
    }
  }

  /**
   * Schedule next execution date
   */
  private async scheduleNextExecution(autoDebit: any) {
    const nextExecutionDate = this.calculateNextExecutionDate(
      parseInt(autoDebit.auto_debit_day),
    );

    await this.db.query(
      `UPDATE contribution_auto_debits 
       SET next_execution_at = $2,
           retry_count = 0
       WHERE id = $1`,
      [autoDebit.id, nextExecutionDate],
    );

    this.logger.log(
      `Scheduled next execution for auto-debit ${autoDebit.id} at ${nextExecutionDate}`,
    );
  }

  /**
   * Calculate next execution date based on auto-debit day
   */
  private calculateNextExecutionDate(autoDebitDay: number): Date {
    const now = new Date();
    const nextDate = new Date(now);

    // Move to next month
    nextDate.setMonth(nextDate.getMonth() + 1);

    // Set the day (handle month-end edge cases)
    const lastDayOfMonth = new Date(
      nextDate.getFullYear(),
      nextDate.getMonth() + 1,
      0,
    ).getDate();
    const targetDay = Math.min(autoDebitDay, lastDayOfMonth);

    nextDate.setDate(targetDay);
    nextDate.setHours(0, 0, 0, 0);

    return nextDate;
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(
    autoDebit: any,
    contribution: any,
    cycle: any,
  ) {
    const message = `Auto-debit successful! KES ${contribution.amount} contributed to ${autoDebit.chama_name} Cycle ${cycle.cycle_number}. Next auto-debit scheduled.`;

    // Send SMS
    if (autoDebit.phone) {
      await this.notification.sendSMSReceipt({
        phoneNumber: autoDebit.phone,
        message: message,
      });
    }

    // Send Email
    if (autoDebit.email) {
      await this.notification.sendEmail({
        to: autoDebit.email,
        subject: `✅ Auto-Debit Successful - ${autoDebit.chama_name}`,
        html: this.generateSuccessEmailHTML(autoDebit, contribution, cycle),
      });
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(
    autoDebit: any,
    cycle: any,
    errorMessage: string,
  ) {
    const retryInfo =
      autoDebit.retry_count < this.MAX_RETRIES
        ? `We'll retry in ${this.RETRY_DELAY_HOURS} hours.`
        : 'Max retries exceeded. Please contribute manually.';

    const message = `Auto-debit failed for ${autoDebit.chama_name} Cycle ${cycle.cycle_number}. Reason: ${errorMessage}. ${retryInfo}`;

    // Send SMS
    if (autoDebit.phone) {
      await this.notification.sendSMSReceipt({
        phoneNumber: autoDebit.phone,
        message: message,
      });
    }

    // Send Email
    if (autoDebit.email) {
      await this.notification.sendEmail({
        to: autoDebit.email,
        subject: `⚠️ Auto-Debit Failed - ${autoDebit.chama_name}`,
        html: this.generateFailureEmailHTML(autoDebit, cycle, errorMessage),
      });
    }
  }

  /**
   * Generate success email HTML
   */
  private generateSuccessEmailHTML(
    autoDebit: any,
    contribution: any,
    cycle: any,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #083232; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .amount { font-size: 28px; font-weight: bold; color: #083232; text-align: center; margin: 20px 0; }
    .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Auto-Debit Successful</h2>
      <p>${autoDebit.chama_name}</p>
    </div>
    <div class="content">
      <div class="success-icon">✅</div>
      <p>Hi ${autoDebit.full_name},</p>
      <p>Your automatic contribution has been processed successfully!</p>
      
      <div class="amount">KES ${contribution.amount.toFixed(2)}</div>
      
      <div class="details">
        <p><strong>Chama:</strong> ${autoDebit.chama_name}</p>
        <p><strong>Cycle:</strong> ${cycle.cycle_number}</p>
        <p><strong>Payment Method:</strong> ${autoDebit.payment_method === 'wallet' ? 'Wallet' : 'M-Pesa'}</p>
        <p><strong>Transaction ID:</strong> ${contribution.contributionId}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
      </div>

      <p style="color: #666; font-size: 14px;">
        Your next auto-debit is scheduled for next month on day ${autoDebit.auto_debit_day}.
      </p>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        You can manage your auto-debit settings anytime in your Cycle account.
      </p>
    </div>
    <div class="footer">
      <p>This is an automated notification from Cycle Platform</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate failure email HTML
   */
  private generateFailureEmailHTML(
    autoDebit: any,
    cycle: any,
    errorMessage: string,
  ): string {
    const retryInfo =
      autoDebit.retry_count < this.MAX_RETRIES
        ? `<p style="color: #2e856e;">We'll automatically retry in ${this.RETRY_DELAY_HOURS} hours.</p>`
        : `<p style="color: #f64d52; font-weight: bold;">Maximum retry attempts reached. Please contribute manually to avoid penalties.</p>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f64d52; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .warning-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .error-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .button { display: inline-block; background: #083232; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Auto-Debit Failed</h2>
      <p>${autoDebit.chama_name}</p>
    </div>
    <div class="content">
      <div class="warning-icon">⚠️</div>
      <p>Hi ${autoDebit.full_name},</p>
      <p>We were unable to process your automatic contribution for Cycle ${cycle.cycle_number}.</p>
      
      <div class="error-box">
        <strong>Reason:</strong> ${errorMessage}
      </div>

      ${retryInfo}

      <div style="text-align: center; margin: 30px 0;">
        <p><strong>Expected Amount:</strong> KES ${parseFloat(cycle.expected_amount).toFixed(2)}</p>
        <p><strong>Due Date:</strong> ${new Date(cycle.due_date).toLocaleDateString('en-GB')}</p>
      </div>

      <div style="text-align: center;">
        <a href="https://cycle.app/contribute" class="button">Contribute Manually</a>
      </div>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        <strong>What to do:</strong>
        <ul>
          <li>If using wallet: Ensure sufficient balance</li>
          <li>If using M-Pesa: Check your M-Pesa account status</li>
          <li>Contribute manually to avoid late penalties</li>
        </ul>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated notification from Cycle Platform</p>
      <p>Need help? Contact support or your chama admin</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Manual trigger for immediate auto-debit execution (can be called via API)
   */
  async executeAutoDebitManually(autoDebitId: string) {
    this.logger.log(`Manually executing auto-debit ${autoDebitId}`);

    const autoDebit = await this.db.query(
      `SELECT 
        ad.*,
        cm.user_id,
        cm.chama_id,
        ch.name as chama_name,
        u.full_name,
        u.email,
        u.phone
      FROM contribution_auto_debits ad
      JOIN chama_members cm ON ad.member_id = cm.id
      JOIN chamas ch ON cm.chama_id = ch.id
      JOIN users u ON cm.user_id = u.id
      WHERE ad.id = $1`,
      [autoDebitId],
    );

    if (autoDebit.rowCount === 0) {
      throw new Error('Auto-debit not found');
    }

    await this.executeAutoDebit(autoDebit.rows[0]);
  }

  /**
   * Get auto-debit execution history
   */
  async getAutoDebitHistory(autoDebitId: string, limit: number = 10) {
    // For now, return recent execution status from the auto_debit record
    // In production, you might want a separate execution_history table
    const result = await this.db.query(
      `SELECT 
        ad.*,
        cm.user_id,
        u.full_name,
        ch.name as chama_name
      FROM contribution_auto_debits ad
      JOIN chama_members cm ON ad.member_id = cm.id
      JOIN chamas ch ON cm.chama_id = ch.id
      JOIN users u ON cm.user_id = u.id
      WHERE ad.id = $1`,
      [autoDebitId],
    );

    return result.rows[0];
  }

  /**
   * Get auto-debit statistics
   */
  async getAutoDebitStats(chamaId?: string) {
    const query = chamaId
      ? `SELECT 
          COUNT(*) FILTER (WHERE enabled = true) as active_count,
          COUNT(*) FILTER (WHERE enabled = false) as inactive_count,
          COUNT(*) FILTER (WHERE last_execution_status = 'success') as success_count,
          COUNT(*) FILTER (WHERE last_execution_status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE last_execution_status = 'insufficient_balance') as insufficient_balance_count
         FROM contribution_auto_debits ad
         JOIN chama_members cm ON ad.member_id = cm.id
         WHERE cm.chama_id = $1`
      : `SELECT 
          COUNT(*) FILTER (WHERE enabled = true) as active_count,
          COUNT(*) FILTER (WHERE enabled = false) as inactive_count,
          COUNT(*) FILTER (WHERE last_execution_status = 'success') as success_count,
          COUNT(*) FILTER (WHERE last_execution_status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE last_execution_status = 'insufficient_balance') as insufficient_balance_count
         FROM contribution_auto_debits`;

    const params = chamaId ? [chamaId] : [];
    const result = await this.db.query(query, params);

    return result.rows[0];
  }
}
