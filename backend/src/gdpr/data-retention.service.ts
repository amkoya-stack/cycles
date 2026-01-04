import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Run data retention cleanup (scheduled daily at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runRetentionCleanup(): Promise<void> {
    this.logger.log('Starting data retention cleanup...');

    try {
      // Get active retention policies
      const policies = await this.db.query(
        `SELECT * FROM data_retention_policies WHERE is_active = TRUE`,
      );

      for (const policy of policies.rows) {
        await this.applyRetentionPolicy(policy);
      }

      this.logger.log('Data retention cleanup completed');
    } catch (error) {
      this.logger.error('Error during data retention cleanup:', error);
    }
  }

  /**
   * Apply retention policy to specific data type
   */
  private async applyRetentionPolicy(policy: any): Promise<void> {
    const { data_type, retention_period_days, auto_delete } = policy;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retention_period_days);

    this.logger.log(
      `Applying retention policy for ${data_type}: ${retention_period_days} days, auto_delete: ${auto_delete}`,
    );

    switch (data_type) {
      case 'user_data':
        await this.cleanupUserData(cutoffDate, auto_delete);
        break;
      case 'transaction_data':
        await this.cleanupTransactionData(cutoffDate, auto_delete);
        break;
      case 'logs':
        await this.cleanupLogs(cutoffDate, auto_delete);
        break;
      case 'documents':
        await this.cleanupDocuments(cutoffDate, auto_delete);
        break;
      default:
        this.logger.warn(`Unknown data type: ${data_type}`);
    }
  }

  /**
   * Cleanup old user data (anonymize or delete)
   */
  private async cleanupUserData(cutoffDate: Date, autoDelete: boolean): Promise<void> {
    // Find users deleted before cutoff date
    const result = await this.db.query(
      `SELECT id FROM users 
       WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
      [cutoffDate],
    );

    for (const user of result.rows) {
      if (autoDelete) {
        // Hard delete (only if no active transactions/chamas)
        await this.hardDeleteUser(user.id);
      } else {
        // Anonymize (already done on deletion, but ensure it's complete)
        await this.ensureUserAnonymized(user.id);
      }
    }

    this.logger.log(`Cleaned up ${result.rows.length} old user records`);
  }

  /**
   * Cleanup old transaction data
   */
  private async cleanupTransactionData(cutoffDate: Date, autoDelete: boolean): Promise<void> {
    // For transactions, we typically don't delete (compliance requirement)
    // Instead, we archive or anonymize
    if (autoDelete) {
      // Only delete if explicitly allowed and no compliance requirement
      const result = await this.db.query(
        `SELECT COUNT(*) FROM financial_transactions 
         WHERE created_at < $1 AND status = 'completed'`,
        [cutoffDate],
      );

      this.logger.log(
        `${result.rows[0].count} old transactions found (not deleted - compliance requirement)`,
      );
    }
  }

  /**
   * Cleanup old logs
   */
  private async cleanupLogs(cutoffDate: Date, autoDelete: boolean): Promise<void> {
    if (autoDelete) {
      // Cleanup audit logs older than retention period
      const result = await this.db.query(
        `DELETE FROM audit_log WHERE created_at < $1 RETURNING id`,
        [cutoffDate],
      );

      this.logger.log(`Deleted ${result.rows.length} old audit log entries`);

      // Cleanup data access logs
      const accessLogsResult = await this.db.query(
        `DELETE FROM data_access_logs WHERE created_at < $1 RETURNING id`,
        [cutoffDate],
      );

      this.logger.log(`Deleted ${accessLogsResult.rows.length} old data access log entries`);
    }
  }

  /**
   * Cleanup old documents
   */
  private async cleanupDocuments(cutoffDate: Date, autoDelete: boolean): Promise<void> {
    if (autoDelete) {
      // Find expired KYC documents
      const kycResult = await this.db.query(
        `UPDATE kyc_documents 
         SET verification_status = 'expired' 
         WHERE expires_at < $1 AND verification_status != 'expired'
         RETURNING id`,
        [cutoffDate],
      );

      this.logger.log(`Expired ${kycResult.rows.length} KYC documents`);

      // Cleanup old data export files (expired exports)
      const exportResult = await this.db.query(
        `UPDATE data_export_requests 
         SET status = 'expired' 
         WHERE expires_at < $1 AND status = 'completed'
         RETURNING id`,
        [cutoffDate],
      );

      this.logger.log(`Expired ${exportResult.rows.length} data export files`);
    }
  }

  /**
   * Hard delete user (only if safe)
   */
  private async hardDeleteUser(userId: string): Promise<void> {
    // Check if user has active transactions or chama memberships
    const activeCheck = await this.db.query(
      `SELECT 
        (SELECT COUNT(*) FROM financial_transactions WHERE user_id = $1) as transaction_count,
        (SELECT COUNT(*) FROM chama_members WHERE user_id = $1 AND status = 'active') as active_chamas`,
      [userId],
    );

    const { transaction_count, active_chamas } = activeCheck.rows[0];

    if (parseInt(transaction_count) > 0 || parseInt(active_chamas) > 0) {
      this.logger.warn(
        `Cannot hard delete user ${userId}: has ${transaction_count} transactions and ${active_chamas} active chamas`,
      );
      return;
    }

    // Safe to hard delete
    await this.db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    this.logger.log(`Hard deleted user ${userId}`);
  }

  /**
   * Ensure user data is fully anonymized
   */
  private async ensureUserAnonymized(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET email = NULL, phone = NULL, full_name = 'Deleted User', 
           id_number = NULL, bio = NULL, profile_photo_url = NULL
       WHERE id = $1`,
      [userId],
    );
  }

  /**
   * Create or update retention policy
   */
  async createOrUpdatePolicy(
    dataType: string,
    retentionPeriodDays: number,
    autoDelete: boolean = false,
    description?: string,
  ): Promise<void> {
    const existing = await this.db.query(
      `SELECT id FROM data_retention_policies WHERE data_type = $1`,
      [dataType],
    );

    if (existing.rows.length > 0) {
      await this.db.query(
        `UPDATE data_retention_policies 
         SET retention_period_days = $1, auto_delete = $2, description = $3, 
             updated_at = CURRENT_TIMESTAMP
         WHERE data_type = $4`,
        [retentionPeriodDays, autoDelete, description || null, dataType],
      );
    } else {
      await this.db.query(
        `INSERT INTO data_retention_policies 
         (data_type, retention_period_days, auto_delete, description)
         VALUES ($1, $2, $3, $4)`,
        [dataType, retentionPeriodDays, autoDelete, description || null],
      );
    }

    this.logger.log(
      `Retention policy updated for ${dataType}: ${retentionPeriodDays} days, auto_delete: ${autoDelete}`,
    );
  }

  /**
   * Get all retention policies
   */
  async getPolicies(): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM data_retention_policies ORDER BY data_type`,
    );
    return result.rows;
  }
}

