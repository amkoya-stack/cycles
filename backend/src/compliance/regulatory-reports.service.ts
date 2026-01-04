import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { AuditTrailService } from '../audit/audit-trail.service';
import { AmlMonitoringService } from '../aml/aml-monitoring.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RegulatoryReportsService {
  private readonly logger = new Logger(RegulatoryReportsService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(AuditTrailService) private readonly auditTrail: AuditTrailService,
    @Inject(AmlMonitoringService) private readonly amlMonitoring: AmlMonitoringService,
  ) {}

  /**
   * Generate monthly regulatory report (scheduled on 1st of each month)
   */
  @Cron('0 0 1 * *') // 1st of month at midnight
  async generateMonthlyReport(): Promise<void> {
    this.logger.log('Generating monthly regulatory report...');

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);

    await this.generateReport('cbk_monthly', startDate, endDate, 'system');
  }

  /**
   * Generate suspicious activity report (SAR)
   */
  async generateSuspiciousActivityReport(
    startDate: Date,
    endDate: Date,
    generatedByUserId: string,
  ): Promise<{ reportId: string; fileUrl: string }> {
    return this.generateReport('suspicious_activity', startDate, endDate, generatedByUserId);
  }

  /**
   * Generate large cash transaction report
   */
  async generateLargeCashReport(
    startDate: Date,
    endDate: Date,
    generatedByUserId: string,
  ): Promise<{ reportId: string; fileUrl: string }> {
    return this.generateReport('large_cash', startDate, endDate, generatedByUserId);
  }

  /**
   * Generate comprehensive regulatory report
   */
  private async generateReport(
    reportType: string,
    startDate: Date,
    endDate: Date,
    generatedByUserId: string,
  ): Promise<{ reportId: string; fileUrl: string }> {
    const reportId = uuidv4();

    try {
      // Collect report data
      const reportData: any = {
        reportType,
        period: { startDate, endDate },
        generatedAt: new Date(),
        generatedBy: generatedByUserId,
      };

      // Transaction summary
      const transactionSummary = await this.getTransactionSummary(startDate, endDate);
      reportData.transactions = transactionSummary;

      // AML alerts summary
      const amlAlerts = await this.amlMonitoring.getAlerts(
        undefined,
        undefined,
        undefined,
        1000,
      );
      const periodAlerts = amlAlerts.filter(
        (alert: any) =>
          new Date(alert.created_at) >= startDate &&
          new Date(alert.created_at) <= endDate,
      );
      reportData.amlAlerts = {
        total: periodAlerts.length,
        bySeverity: this.groupBySeverity(periodAlerts),
        byType: this.groupByType(periodAlerts),
      };

      // User statistics
      const userStats = await this.getUserStatistics(startDate, endDate);
      reportData.users = userStats;

      // KYC statistics
      const kycStats = await this.getKycStatistics(startDate, endDate);
      reportData.kyc = kycStats;

      // Compliance audit trail
      const complianceLogs = await this.auditTrail.getComplianceAuditTrail(
        startDate,
        endDate,
      );
      reportData.complianceLogs = {
        total: complianceLogs.length,
        byAction: this.groupByAction(complianceLogs),
      };

      // Generate report file
      const fileUrl = await this.saveReportFile(reportId, reportData);

      // Save report record
      await this.db.query(
        `INSERT INTO regulatory_reports 
         (id, report_type, period_start, period_end, generated_by_user_id, file_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted')`,
        [reportId, reportType, startDate, endDate, generatedByUserId, fileUrl],
      );

      this.logger.log(`Regulatory report generated: ${reportId}`);

      return { reportId, fileUrl };
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction summary for period
   */
  private async getTransactionSummary(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE type = 'deposit') as deposits,
        COUNT(*) FILTER (WHERE type = 'withdrawal') as withdrawals,
        COUNT(*) FILTER (WHERE type = 'contribution') as contributions,
        COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0) as total_deposits,
        COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0) as total_withdrawals,
        COALESCE(SUM(amount) FILTER (WHERE type = 'contribution'), 0) as total_contributions,
        COUNT(*) FILTER (WHERE amount >= 500000) as large_transactions
       FROM financial_transactions
       WHERE created_at >= $1 AND created_at <= $2 AND status = 'completed'`,
      [startDate, endDate],
    );

    return result.rows[0];
  }

  /**
   * Get user statistics for period
   */
  private async getUserStatistics(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2) as new_users,
        COUNT(*) FILTER (WHERE kyc_status = 'verified') as verified_users,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users
       FROM users
       WHERE created_at <= $2`,
      [startDate, endDate],
    );

    return result.rows[0];
  }

  /**
   * Get KYC statistics for period
   */
  private async getKycStatistics(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2) as documents_uploaded,
        COUNT(*) FILTER (WHERE verification_status = 'verified' AND verified_at >= $1 AND verified_at <= $2) as documents_verified,
        COUNT(*) FILTER (WHERE verification_status = 'rejected' AND verified_at >= $1 AND verified_at <= $2) as documents_rejected
       FROM kyc_documents
       WHERE created_at <= $2`,
      [startDate, endDate],
    );

    return result.rows[0];
  }

  /**
   * Group alerts by severity
   */
  private groupBySeverity(alerts: any[]): Record<string, number> {
    return alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Group alerts by type
   */
  private groupByType(alerts: any[]): Record<string, number> {
    return alerts.reduce((acc, alert) => {
      acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Group logs by action
   */
  private groupByAction(logs: any[]): Record<string, number> {
    return logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Save report file
   */
  private async saveReportFile(reportId: string, data: any): Promise<string> {
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `report_${reportId}_${Date.now()}.json`;
    const filePath = path.join(reportsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // In production, upload to S3 and return URL
    return `/reports/${fileName}`;
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM regulatory_reports WHERE id = $1`,
      [reportId],
    );

    if (result.rows.length === 0) {
      throw new Error('Report not found');
    }

    return result.rows[0];
  }

  /**
   * Get all reports
   */
  async getReports(limit: number = 50): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM regulatory_reports 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit],
    );

    return result.rows;
  }
}

