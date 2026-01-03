/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../common/services/metrics.service';
import { v4 as uuidv4 } from 'uuid';

export interface ReconciliationResult {
  runId: string;
  status: 'completed' | 'failed' | 'warning';
  isBalanced: boolean;
  ledgerBalance: number;
  ledgerBalanceFormatted: string;
  externalBalance?: number;
  difference: number;
  mismatchCount: number;
  mismatches: any[];
  startedAt: Date;
  completedAt: Date;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Run daily reconciliation check
   * Validates ledger integrity and compares with external systems
   */
  async runDailyReconciliation(): Promise<ReconciliationResult> {
    const runId = uuidv4();
    const startedAt = new Date();

    this.logger.log(`Starting daily reconciliation run: ${runId}`);

    try {
      // Create reconciliation run record
      await this.db.query(
        `INSERT INTO reconciliation_runs (id, run_type, status, started_at)
         VALUES ($1, 'daily', 'running', $2)`,
        [runId, startedAt],
      );

      // Step 1: Verify ledger balance (debits = credits)
      const balanceCheck = await this.checkLedgerBalance();

      // Step 2: Check individual accounts for anomalies
      const accountChecks = await this.checkAccountBalances(runId);

      // Step 3: Validate transaction integrity
      const transactionChecks = await this.validateTransactionIntegrity();

      // Compile results
      const mismatches: any[] = [];
      let mismatchCount = 0;

      if (!balanceCheck.isBalanced) {
        mismatches.push({
          type: 'ledger_imbalance',
          severity: 'critical',
          ...balanceCheck,
        });
        mismatchCount++;
      }

      if (accountChecks.negativeBalances.length > 0) {
        mismatches.push({
          type: 'negative_balances',
          severity: 'high',
          count: accountChecks.negativeBalances.length,
          accounts: accountChecks.negativeBalances,
        });
        mismatchCount += accountChecks.negativeBalances.length;
      }

      if (transactionChecks.unbalancedTransactions.length > 0) {
        mismatches.push({
          type: 'unbalanced_transactions',
          severity: 'critical',
          count: transactionChecks.unbalancedTransactions.length,
          transactions: transactionChecks.unbalancedTransactions,
        });
        mismatchCount += transactionChecks.unbalancedTransactions.length;
      }

      const completedAt = new Date();
      const status =
        mismatchCount > 0
          ? mismatches.some((m) => m.severity === 'critical')
            ? 'failed'
            : 'warning'
          : 'completed';

      // Update reconciliation run
      await this.db.query(
        `UPDATE reconciliation_runs 
         SET status = $1, 
             ledger_balance = $2,
             difference = $3,
             is_balanced = $4,
             mismatch_count = $5,
             mismatches = $6,
             completed_at = $7
         WHERE id = $8`,
        [
          status,
          balanceCheck.totalDebitBalance,
          balanceCheck.difference,
          balanceCheck.isBalanced,
          mismatchCount,
          JSON.stringify(mismatches),
          completedAt,
          runId,
        ],
      );

      const result: ReconciliationResult = {
        runId,
        status,
        isBalanced: balanceCheck.isBalanced && mismatchCount === 0,
        ledgerBalance: balanceCheck.totalDebitBalance,
        ledgerBalanceFormatted: `KES ${balanceCheck.totalDebitBalance.toFixed(2)}`,
        difference: balanceCheck.difference,
        mismatchCount,
        mismatches,
        startedAt,
        completedAt,
      };

      // Record metrics
      this.metrics.updateLedgerReconciliationStatus('daily', status === 'completed' ? 'success' : 'failed');
      if (transactionChecks.unbalancedTransactions.length > 0) {
        this.metrics.updateUnbalancedTransactionsCount(transactionChecks.unbalancedTransactions.length);
      } else {
        this.metrics.updateUnbalancedTransactionsCount(0);
      }

      // Send alerts if issues found
      if (status !== 'completed') {
        await this.sendAlert(result);
      }

      this.logger.log(
        `Reconciliation run ${runId} ${status}: ${mismatchCount} issues found`,
      );

      return result;
    } catch (error) {
      // Record failure metrics
      this.metrics.updateLedgerReconciliationStatus('daily', 'failed');
      
      this.logger.error(`Reconciliation run ${runId} failed:`, error);

      await this.db.query(
        `UPDATE reconciliation_runs 
         SET status = 'failed', error_message = $1, completed_at = $2
         WHERE id = $3`,
        [error.message, new Date(), runId],
      );

      throw error;
    }
  }

  /**
   * Check if ledger is balanced (total debits = total credits)
   */
  private async checkLedgerBalance(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN at.normality = 'debit' THEN a.balance ELSE 0 END), 0) AS total_debit_balance,
        COALESCE(SUM(CASE WHEN at.normality = 'credit' THEN a.balance ELSE 0 END), 0) AS total_credit_balance,
        COALESCE(SUM(CASE WHEN at.normality = 'debit' THEN a.balance ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN at.normality = 'credit' THEN a.balance ELSE 0 END), 0) AS difference
      FROM accounts a
      JOIN account_types at ON a.account_type_id = at.id
      WHERE a.status = 'active'
    `);

    const row = result.rows[0];
    const difference = parseFloat(row.difference);

    return {
      totalDebitBalance: parseFloat(row.total_debit_balance),
      totalCreditBalance: parseFloat(row.total_credit_balance),
      difference,
      isBalanced: Math.abs(difference) < 0.01, // Allow 1 cent tolerance
    };
  }

  /**
   * Check for anomalies in account balances
   */
  private async checkAccountBalances(runId: string): Promise<any> {
    // Find accounts with negative balances (shouldn't happen for liability accounts)
    const negativeBalances = await this.db.query(`
      SELECT a.id, a.account_number, a.name, a.balance, at.code, at.normality
      FROM accounts a
      JOIN account_types at ON a.account_type_id = at.id
      WHERE a.balance < 0 
        AND at.normality = 'credit'
        AND at.code IN ('USER_WALLET', 'CHAMA_WALLET')
        AND a.status = 'active'
    `);

    // Record each issue
    for (const account of negativeBalances.rows) {
      await this.db.query(
        `INSERT INTO reconciliation_items (
          reconciliation_run_id, account_id, account_number, account_name,
          ledger_balance, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, 'mismatch', $6)`,
        [
          runId,
          account.id,
          account.account_number,
          account.name,
          account.balance,
          JSON.stringify({
            issue: 'negative_balance',
            account_type: account.code,
          }),
        ],
      );
    }

    return {
      negativeBalances: negativeBalances.rows,
    };
  }

  /**
   * Validate transaction integrity (debits = credits for each transaction)
   */
  private async validateTransactionIntegrity(): Promise<any> {
    const unbalanced = await this.db.query(`
      SELECT 
        t.id,
        t.reference,
        t.description,
        COALESCE(SUM(CASE WHEN e.direction = 'debit' THEN e.amount ELSE 0 END), 0) AS total_debits,
        COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END), 0) AS total_credits,
        ABS(
          COALESCE(SUM(CASE WHEN e.direction = 'debit' THEN e.amount ELSE 0 END), 0) - 
          COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END), 0)
        ) AS difference
      FROM transactions t
      LEFT JOIN entries e ON t.id = e.transaction_id
      WHERE t.status = 'completed'
      GROUP BY t.id, t.reference, t.description
      HAVING ABS(
        COALESCE(SUM(CASE WHEN e.direction = 'debit' THEN e.amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END), 0)
      ) > 0.01
      LIMIT 100
    `);

    return {
      unbalancedTransactions: unbalanced.rows,
    };
  }

  /**
   * Send alert notification for reconciliation issues
   */
  private async sendAlert(result: ReconciliationResult): Promise<void> {
    // TODO: Integrate with email/Slack/SMS notification service
    this.logger.error(`🚨 RECONCILIATION ALERT: Run ${result.runId}`, {
      status: result.status,
      mismatchCount: result.mismatchCount,
      mismatches: result.mismatches,
    });

    // For now, just log. In production, send to:
    // - Email: finance team
    // - Slack: #alerts channel
    // - PagerDuty: for critical issues
  }

  /**
   * Get reconciliation history
   */
  async getReconciliationHistory(limit = 30): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM reconciliation_runs 
       ORDER BY started_at DESC 
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  /**
   * Get details of a specific reconciliation run
   */
  async getReconciliationDetails(runId: string): Promise<any> {
    const runResult = await this.db.query(
      'SELECT * FROM reconciliation_runs WHERE id = $1',
      [runId],
    );

    if (runResult.rows.length === 0) {
      throw new Error('Reconciliation run not found');
    }

    const itemsResult = await this.db.query(
      'SELECT * FROM reconciliation_items WHERE reconciliation_run_id = $1',
      [runId],
    );

    return {
      ...runResult.rows[0],
      items: itemsResult.rows,
    };
  }

  /**
   * Reconcile M-Pesa transactions with ledger
   * Matches mpesa_callbacks with transactions table
   */
  async reconcileMpesaTransactions(): Promise<any> {
    const runId = uuidv4();
    const startedAt = new Date();

    this.logger.log(`Starting M-Pesa reconciliation: ${runId}`);

    const mismatches: any[] = [];

    try {
      // Get all completed M-Pesa callbacks
      const callbacksResult = await this.db.query(
        `SELECT 
          mc.id,
          mc.checkout_request_id,
          mc.merchant_request_id,
          mc.mpesa_receipt_number,
          mc.phone_number,
          mc.amount,
          mc.transaction_date,
          mc.result_code,
          mc.result_desc,
          t.id as transaction_id,
          t.reference as ledger_reference,
          t.status as ledger_status,
          e.amount as ledger_amount
        FROM mpesa_callbacks mc
        LEFT JOIN transactions t ON t.external_reference = mc.mpesa_receipt_number
        LEFT JOIN entries e ON t.id = e.transaction_id
        WHERE mc.result_code = '0'
          AND mc.created_at >= NOW() - INTERVAL '24 hours'`,
      );

      this.logger.log(
        `Found ${callbacksResult.rows.length} M-Pesa callbacks to reconcile`,
      );

      for (const callback of callbacksResult.rows) {
        let mismatchType: string | null = null;
        let details: any = {};

        // Check 1: M-Pesa callback without matching ledger transaction
        if (!callback.transaction_id) {
          mismatchType = 'missing_ledger';
          details = {
            mpesaReceipt: callback.mpesa_receipt_number,
            amount: callback.amount,
            phoneNumber: callback.phone_number,
            transactionDate: callback.transaction_date,
          };
        }
        // Check 2: Amount mismatch
        else if (
          Math.abs(
            parseFloat(callback.amount) - parseFloat(callback.ledger_amount),
          ) > 0.01
        ) {
          mismatchType = 'amount_mismatch';
          details = {
            mpesaReceipt: callback.mpesa_receipt_number,
            mpesaAmount: callback.amount,
            ledgerAmount: callback.ledger_amount,
            difference:
              parseFloat(callback.amount) - parseFloat(callback.ledger_amount),
          };
        }
        // Check 3: Status mismatch (M-Pesa succeeded but ledger failed)
        else if (
          callback.result_code === '0' &&
          callback.ledger_status !== 'completed'
        ) {
          mismatchType = 'status_mismatch';
          details = {
            mpesaReceipt: callback.mpesa_receipt_number,
            mpesaStatus: 'success',
            ledgerStatus: callback.ledger_status,
          };
        }

        // Record mismatch in mpesa_reconciliation table
        if (mismatchType) {
          await this.db.query(
            `INSERT INTO mpesa_reconciliation 
              (mpesa_callback_id, transaction_id, mismatch_type, mpesa_amount, ledger_amount, status, details)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
            [
              callback.id,
              callback.transaction_id,
              mismatchType,
              callback.amount,
              callback.ledger_amount,
              JSON.stringify(details),
            ],
          );

          mismatches.push({
            type: mismatchType,
            mpesaReceipt: callback.mpesa_receipt_number,
            ...details,
          });

          this.logger.warn(
            `M-Pesa mismatch detected: ${mismatchType} - ${callback.mpesa_receipt_number}`,
          );
        }
      }

      // Check for ledger transactions without M-Pesa callbacks (reverse check)
      const orphanedTransactionsResult = await this.db.query(
        `SELECT 
          t.id,
          t.reference,
          t.external_reference,
          t.description,
          e.amount
        FROM transactions t
        JOIN entries e ON t.id = e.transaction_id
        LEFT JOIN mpesa_callbacks mc ON t.external_reference = mc.mpesa_receipt_number
        WHERE t.description LIKE '%M-Pesa%'
          AND mc.id IS NULL
          AND t.created_at >= NOW() - INTERVAL '24 hours'
          AND t.status = 'completed'`,
      );

      for (const orphan of orphanedTransactionsResult.rows) {
        mismatches.push({
          type: 'missing_callback',
          ledgerReference: orphan.reference,
          externalReference: orphan.external_reference,
          amount: orphan.amount,
          description: orphan.description,
        });

        this.logger.warn(`Orphaned ledger transaction: ${orphan.reference}`);
      }

      const completedAt = new Date();

      // Send alert if mismatches found
      if (mismatches.length > 0) {
        this.logger.error(
          `🚨 M-Pesa Reconciliation Alert: ${mismatches.length} mismatches found`,
          {
            runId,
            mismatchCount: mismatches.length,
            mismatches,
          },
        );
      }

      this.logger.log(
        `M-Pesa reconciliation completed: ${mismatches.length} mismatches found`,
      );

      return {
        runId,
        status: mismatches.length > 0 ? 'warning' : 'completed',
        mismatchCount: mismatches.length,
        mismatches,
        startedAt,
        completedAt,
      };
    } catch (error) {
      this.logger.error(
        `M-Pesa reconciliation failed: ${error.message}`,
        error.stack,
      );

      return {
        runId,
        status: 'failed',
        error: error.message,
        startedAt,
        completedAt: new Date(),
      };
    }
  }
}
