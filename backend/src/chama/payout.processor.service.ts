import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { PayoutService } from './payout.service';

@Injectable()
export class PayoutProcessorService {
  private readonly logger = new Logger(PayoutProcessorService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly payoutService: PayoutService,
  ) {}

  /**
   * Process pending payouts daily at 1 AM
   * Executes payouts that are scheduled for today or earlier
   */
  @Cron('0 1 * * *', {
    name: 'process-pending-payouts',
    timeZone: 'Africa/Nairobi',
  })
  async processPendingPayouts() {
    this.logger.log('Starting pending payouts processing...');

    try {
      // Get all pending payouts scheduled for today or earlier
      const result = await this.db.query(
        `SELECT p.id, p.amount, u.full_name as recipient_name, c.name as chama_name
         FROM payouts p
         JOIN chama_members cm ON p.recipient_member_id = cm.id
         JOIN users u ON cm.user_id = u.id
         JOIN chamas c ON p.chama_id = c.id
         WHERE p.status = 'pending'
         AND p.scheduled_at <= NOW()
         ORDER BY p.scheduled_at ASC`,
      );

      const pendingPayouts = result.rows;

      if (pendingPayouts.length === 0) {
        this.logger.log('No pending payouts to process');
        return;
      }

      this.logger.log(`Found ${pendingPayouts.length} pending payouts`);

      let successCount = 0;
      let failureCount = 0;

      // Process each payout
      for (const payout of pendingPayouts) {
        try {
          this.logger.log(
            `Processing payout ${payout.id} - ${payout.chama_name} → ${payout.recipient_name} (KES ${payout.amount})`,
          );

          await this.payoutService.executePayout(payout.id);
          successCount++;

          this.logger.log(`✓ Payout ${payout.id} executed successfully`);
        } catch (error) {
          failureCount++;
          this.logger.error(
            `✗ Failed to process payout ${payout.id}: ${error.message}`,
            error.stack,
          );

          // Continue processing other payouts even if one fails
        }
      }

      this.logger.log(
        `Pending payouts processing complete: ${successCount} succeeded, ${failureCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        'Error in processPendingPayouts:',
        error.message,
        error.stack,
      );
    }
  }

  /**
   * Retry failed payouts daily at 3 AM
   * Only retries payouts that:
   * - Have status 'failed'
   * - Have been retried less than 3 times
   * - Failed at least 6 hours ago (to avoid rapid retries)
   */
  @Cron('0 3 * * *', {
    name: 'retry-failed-payouts',
    timeZone: 'Africa/Nairobi',
  })
  async retryFailedPayouts() {
    this.logger.log('Starting failed payouts retry...');

    try {
      // Get failed payouts eligible for retry
      const result = await this.db.query(
        `SELECT p.id, p.amount, p.retry_count, p.failed_reason,
                u.full_name as recipient_name, c.name as chama_name
         FROM payouts p
         JOIN chama_members cm ON p.recipient_member_id = cm.id
         JOIN users u ON cm.user_id = u.id
         JOIN chamas c ON p.chama_id = c.id
         WHERE p.status = 'failed'
         AND COALESCE(p.retry_count, 0) < 3
         AND p.updated_at < NOW() - INTERVAL '6 hours'
         ORDER BY p.scheduled_at ASC`,
      );

      const failedPayouts = result.rows;

      if (failedPayouts.length === 0) {
        this.logger.log('No failed payouts to retry');
        return;
      }

      this.logger.log(
        `Found ${failedPayouts.length} failed payouts eligible for retry`,
      );

      let successCount = 0;
      let failureCount = 0;

      // Retry each payout
      for (const payout of failedPayouts) {
        try {
          this.logger.log(
            `Retrying payout ${payout.id} (attempt ${payout.retry_count + 1}/3) - ${payout.chama_name} → ${payout.recipient_name}`,
          );

          // Increment retry count before attempting
          await this.db.query(
            'UPDATE payouts SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = $1',
            [payout.id],
          );

          await this.payoutService.retryFailedPayout(payout.id);
          successCount++;

          this.logger.log(`✓ Payout ${payout.id} retry succeeded`);
        } catch (error) {
          failureCount++;
          this.logger.error(
            `✗ Payout ${payout.id} retry failed: ${error.message}`,
            error.stack,
          );

          // Check if max retries reached
          const retryCount = payout.retry_count + 1;
          if (retryCount >= 3) {
            this.logger.warn(
              `Payout ${payout.id} has reached maximum retry attempts (3). Manual intervention required.`,
            );

            // Update status to indicate manual intervention needed
            await this.db.query(
              `UPDATE payouts 
               SET failed_reason = $1 
               WHERE id = $2`,
              [
                `Max retries reached. Original error: ${payout.failed_reason}`,
                payout.id,
              ],
            );
          }
        }
      }

      this.logger.log(
        `Failed payouts retry complete: ${successCount} succeeded, ${failureCount} still failed`,
      );
    } catch (error) {
      this.logger.error(
        'Error in retryFailedPayouts:',
        error.message,
        error.stack,
      );
    }
  }

  /**
   * Generate payout summary report weekly (Sunday at 9 AM)
   * Sends summary to platform admins
   */
  @Cron('0 9 * * 0', {
    name: 'weekly-payout-report',
    timeZone: 'Africa/Nairobi',
  })
  async generateWeeklyPayoutReport() {
    this.logger.log('Generating weekly payout report...');

    try {
      // Get stats for the past week
      const result = await this.db.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_amount_paid,
          COALESCE(AVG(amount) FILTER (WHERE status = 'completed'), 0) as avg_payout_amount
         FROM payouts
         WHERE created_at >= NOW() - INTERVAL '7 days'`,
      );

      const stats = result.rows[0];

      this.logger.log('Weekly Payout Summary:');
      this.logger.log(`  Completed: ${stats.completed_count}`);
      this.logger.log(`  Failed: ${stats.failed_count}`);
      this.logger.log(`  Pending: ${stats.pending_count}`);
      this.logger.log(
        `  Total Amount Paid: KES ${parseFloat(stats.total_amount_paid).toLocaleString()}`,
      );
      this.logger.log(
        `  Average Payout: KES ${parseFloat(stats.avg_payout_amount).toLocaleString()}`,
      );

      // TODO: Send email report to admins
      // await this.notificationService.sendAdminReport(stats);
    } catch (error) {
      this.logger.error(
        'Error generating weekly report:',
        error.message,
        error.stack,
      );
    }
  }

  /**
   * Clean up old completed payouts (keep for 1 year)
   * Runs monthly on the 1st at 2 AM
   */
  @Cron('0 2 1 * *', {
    name: 'archive-old-payouts',
    timeZone: 'Africa/Nairobi',
  })
  async archiveOldPayouts() {
    this.logger.log('Archiving old payouts...');

    try {
      // Archive payouts older than 1 year
      // (In production, this would move to archive table rather than delete)
      const result = await this.db.query(
        `SELECT COUNT(*) as count
         FROM payouts
         WHERE status = 'completed'
         AND executed_at < NOW() - INTERVAL '1 year'`,
      );

      const count = parseInt(result.rows[0].count);

      if (count === 0) {
        this.logger.log('No payouts to archive');
        return;
      }

      this.logger.log(`Found ${count} payouts to archive (older than 1 year)`);

      // TODO: In production, move to archive table
      // For now, just log (don't delete)
      this.logger.log('Archive process skipped (not implemented yet)');
    } catch (error) {
      this.logger.error('Error archiving payouts:', error.message, error.stack);
    }
  }

  /**
   * Check for overdue pending payouts
   * Runs every 6 hours
   */
  @Cron('0 */6 * * *', {
    name: 'check-overdue-payouts',
    timeZone: 'Africa/Nairobi',
  })
  async checkOverduePayouts() {
    this.logger.log('Checking for overdue payouts...');

    try {
      // Get payouts scheduled more than 24 hours ago that are still pending
      const result = await this.db.query(
        `SELECT p.id, p.amount, p.scheduled_at,
                u.full_name as recipient_name, 
                u.phone as recipient_phone,
                c.name as chama_name
         FROM payouts p
         JOIN chama_members cm ON p.recipient_member_id = cm.id
         JOIN users u ON cm.user_id = u.id
         JOIN chamas c ON p.chama_id = c.id
         WHERE p.status = 'pending'
         AND p.scheduled_at < NOW() - INTERVAL '24 hours'
         ORDER BY p.scheduled_at ASC`,
      );

      const overduePayouts = result.rows;

      if (overduePayouts.length === 0) {
        this.logger.log('No overdue payouts found');
        return;
      }

      this.logger.warn(
        `Found ${overduePayouts.length} overdue payouts (pending > 24 hours)`,
      );

      // Log details for admin review
      for (const payout of overduePayouts) {
        const hoursOverdue = Math.floor(
          (Date.now() - new Date(payout.scheduled_at).getTime()) /
            (1000 * 60 * 60),
        );

        this.logger.warn(
          `Overdue payout: ${payout.id} - ${payout.chama_name} → ${payout.recipient_name} - ` +
            `KES ${payout.amount} (${hoursOverdue} hours overdue)`,
        );
      }

      // TODO: Send alert to admins via email/Slack
    } catch (error) {
      this.logger.error(
        'Error checking overdue payouts:',
        error.message,
        error.stack,
      );
    }
  }
}
