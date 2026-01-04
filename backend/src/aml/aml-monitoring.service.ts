import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionMonitoringRule {
  ruleType: 'large_transaction' | 'velocity_check' | 'pattern_detection';
  threshold?: number;
  timeWindow?: number; // in hours
  enabled: boolean;
}

@Injectable()
export class AmlMonitoringService {
  private readonly logger = new Logger(AmlMonitoringService.name);

  // Default monitoring thresholds
  private readonly LARGE_TRANSACTION_THRESHOLD = 500000; // KSh 500,000
  private readonly VELOCITY_CHECK_THRESHOLD = 1000000; // KSh 1,000,000 in 24 hours
  private readonly VELOCITY_WINDOW_HOURS = 24;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Monitor transaction for AML compliance
   */
  async monitorTransaction(
    transactionId: string,
    userId: string,
    chamaId: string | null,
    amount: number,
    transactionType: string,
  ): Promise<void> {
    // Check for large transactions
    if (amount >= this.LARGE_TRANSACTION_THRESHOLD) {
      await this.createAlert({
        userId,
        chamaId,
        transactionId,
        alertType: 'large_transaction',
        severity: amount >= 1000000 ? 'high' : 'medium',
        description: `Large transaction detected: KSh ${amount.toLocaleString()}`,
        riskScore: this.calculateRiskScore(amount, transactionType),
        metadata: { amount, transactionType },
      });
    }

    // Check transaction velocity (multiple transactions in short time)
    await this.checkVelocity(userId, amount);

    // Check for suspicious patterns
    await this.checkSuspiciousPatterns(userId, transactionType, amount);
  }

  /**
   * Check transaction velocity (rapid successive transactions)
   */
  private async checkVelocity(userId: string, amount: number): Promise<void> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - this.VELOCITY_WINDOW_HOURS);

    const result = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as transaction_count
       FROM financial_transactions
       WHERE user_id = $1 
         AND created_at >= $2 
         AND status = 'completed'`,
      [userId, windowStart],
    );

    const totalAmount = parseFloat(result.rows[0].total_amount || '0');
    const transactionCount = parseInt(result.rows[0].transaction_count || '0');

    if (totalAmount >= this.VELOCITY_CHECK_THRESHOLD) {
      await this.createAlert({
        userId,
        alertType: 'velocity_check',
        severity: totalAmount >= 2000000 ? 'high' : 'medium',
        description: `High transaction velocity detected: ${transactionCount} transactions totaling KSh ${totalAmount.toLocaleString()} in ${this.VELOCITY_WINDOW_HOURS} hours`,
        riskScore: this.calculateVelocityRiskScore(totalAmount, transactionCount),
        metadata: { totalAmount, transactionCount, windowHours: this.VELOCITY_WINDOW_HOURS },
      });
    }
  }

  /**
   * Check for suspicious transaction patterns
   */
  private async checkSuspiciousPatterns(
    userId: string,
    transactionType: string,
    amount: number,
  ): Promise<void> {
    // Check for round number transactions (potential structuring)
    if (amount % 10000 === 0 && amount >= 100000) {
      await this.createAlert({
        userId,
        alertType: 'suspicious_pattern',
        severity: 'medium',
        description: `Round number transaction detected: KSh ${amount.toLocaleString()} (potential structuring)`,
        riskScore: 40,
        metadata: { amount, transactionType, pattern: 'round_number' },
      });
    }

    // Check for rapid deposit-withdrawal pattern
    const recentPattern = await this.db.query(
      `SELECT type, COUNT(*) as count
       FROM financial_transactions
       WHERE user_id = $1 
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
         AND status = 'completed'
       GROUP BY type`,
      [userId],
    );

    const hasDeposit = recentPattern.rows.some((r) => r.type === 'deposit');
    const hasWithdrawal = recentPattern.rows.some((r) => r.type === 'withdrawal');

    if (hasDeposit && hasWithdrawal && transactionType === 'withdrawal') {
      await this.createAlert({
        userId,
        alertType: 'suspicious_pattern',
        severity: 'medium',
        description: 'Rapid deposit-withdrawal pattern detected (potential money laundering)',
        riskScore: 50,
        metadata: { pattern: 'rapid_deposit_withdrawal' },
      });
    }
  }

  /**
   * Screen user against watchlists
   */
  async screenUser(userId: string): Promise<{ matchFound: boolean; matches: any[] }> {
    // Get user details
    const userResult = await this.db.query(
      `SELECT full_name, id_number, phone, email FROM users WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return { matchFound: false, matches: [] };
    }

    const user = userResult.rows[0];
    const matches: any[] = [];

    // In a real implementation, you would integrate with:
    // - OFAC (Office of Foreign Assets Control) sanctions list
    // - PEP (Politically Exposed Persons) database
    // - Adverse media screening
    // - Custom watchlists

    // For now, we'll create a placeholder that logs the check
    // In production, integrate with services like:
    // - Dow Jones Risk & Compliance
    // - World-Check
    // - Refinitiv

    const checkResult = await this.db.query(
      `INSERT INTO watchlist_checks 
       (user_id, check_type, list_name, match_found, checked_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, 'sanctions', 'OFAC', false],
    );

    // TODO: Implement actual watchlist screening API integration
    this.logger.log(`Watchlist check performed for user ${userId}`);

    return { matchFound: matches.length > 0, matches };
  }

  /**
   * Create AML alert
   */
  private async createAlert(alert: {
    userId?: string;
    chamaId?: string | null;
    transactionId?: string;
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    riskScore: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const alertId = uuidv4();

    await this.db.query(
      `INSERT INTO aml_alerts 
       (id, user_id, chama_id, transaction_id, alert_type, severity, description, risk_score, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9)`,
      [
        alertId,
        alert.userId || null,
        alert.chamaId || null,
        alert.transactionId || null,
        alert.alertType,
        alert.severity,
        alert.description,
        alert.riskScore,
        JSON.stringify(alert.metadata || {}),
      ],
    );

    this.logger.warn(`AML Alert created: ${alert.alertType} - ${alert.description}`);

    return alertId;
  }

  /**
   * Calculate risk score based on transaction amount and type
   */
  private calculateRiskScore(amount: number, transactionType: string): number {
    let score = 0;

    // Base score from amount
    if (amount >= 1000000) score += 60;
    else if (amount >= 500000) score += 40;
    else if (amount >= 200000) score += 20;

    // Adjust based on transaction type
    if (transactionType === 'withdrawal') score += 10;
    if (transactionType === 'transfer') score += 5;

    return Math.min(score, 100);
  }

  /**
   * Calculate risk score for velocity checks
   */
  private calculateVelocityRiskScore(totalAmount: number, transactionCount: number): number {
    let score = 0;

    if (totalAmount >= 2000000) score += 70;
    else if (totalAmount >= 1000000) score += 50;

    if (transactionCount >= 10) score += 20;
    else if (transactionCount >= 5) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Get AML alerts for user or admin
   */
  async getAlerts(
    userId?: string,
    status?: string,
    severity?: string,
    limit: number = 50,
  ): Promise<any[]> {
    let query = `SELECT * FROM aml_alerts WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Resolve AML alert
   */
  async resolveAlert(
    alertId: string,
    resolvedByUserId: string,
    resolutionNotes: string,
    status: 'resolved' | 'false_positive' = 'resolved',
  ): Promise<void> {
    await this.db.query(
      `UPDATE aml_alerts 
       SET status = $1, assigned_to_user_id = $2, resolution_notes = $3, 
           resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [status, resolvedByUserId, resolutionNotes, alertId],
    );

    this.logger.log(`AML alert ${alertId} resolved by ${resolvedByUserId}`);
  }
}

