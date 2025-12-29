/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { mapQueryRow } from '../database/mapper.util';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationService } from './notification.service';
import { WalletGateway } from './wallet.gateway';
import { LimitsService } from './limits.service';

@Injectable()
export class MpesaReconciliationService {
  private readonly logger = new Logger(MpesaReconciliationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly notification: NotificationService,
    private readonly walletGateway: WalletGateway,
    private readonly limits: LimitsService,
  ) {}

  /**
   * Process completed M-Pesa callbacks and update ledger
   * Runs every minute as CRON job
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processCompletedCallbacks(): Promise<void> {
    this.logger.log('Processing completed M-Pesa callbacks...');

    // Get all completed callbacks that haven't been processed yet
    const callbacks = await this.db.query(
      `SELECT * FROM mpesa_callbacks 
       WHERE status = 'completed' 
       AND transaction_id IS NULL 
       AND result_code = 0
       ORDER BY callback_received_at ASC
       LIMIT 50`,
    );

    this.logger.log(`Found ${callbacks.rowCount} callbacks to process`);

    for (const callback of callbacks.rows) {
      try {
        await this.processCallback(callback);
      } catch (error) {
        this.logger.error(
          `Failed to process callback ${callback.checkout_request_id}`,
          error,
        );
      }
    }
  }

  /**
   * Process a single callback
   */
  private async processCallback(callback: any): Promise<void> {
    const {
      id: callbackId,
      user_id: userId,
      amount,
      mpesa_receipt_number: mpesaReceiptNumber,
      checkout_request_id: checkoutRequestId,
      transaction_type: transactionType,
    } = callback;

    this.logger.log(
      `Processing ${transactionType} callback: ${checkoutRequestId}`,
    );

    // Convert amount to number once (it comes as string from database)
    const numericAmount = parseFloat(amount);

    if (transactionType === 'deposit') {
      // Complete deposit through ledger
      const result = await this.ledger.processDeposit(
        userId,
        numericAmount,
        checkoutRequestId, // Use as external reference for idempotency
        `M-Pesa deposit - Receipt: ${mpesaReceiptNumber}`,
      );

      // Update callback record with transaction ID
      await this.db.query(
        `UPDATE mpesa_callbacks 
         SET transaction_id = $1,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{ledger_processed}',
               'true'::jsonb
             )
         WHERE id = $2`,
        [result.transactionId, callbackId],
      );

      // Send notification
      try {
        const userResult = await this.db.query(
          'SELECT email, phone FROM users WHERE id = $1',
          [userId],
        );
        const user = mapQueryRow<{ email: string | null; phone: string | null }>(userResult);
        if (user) {
          await this.notification.sendDepositReceipt(
            user.email || '',
            user.phone || '',
            numericAmount,
            checkoutRequestId,
            mpesaReceiptNumber,
          );
        }
      } catch (error) {
        this.logger.error('Failed to send deposit notification', error);
      }

      // Record usage for limits tracking
      try {
        await this.limits.recordUsage(userId, 'deposit', numericAmount);
      } catch (error) {
        this.logger.error('Failed to record deposit usage', error);
      }

      // Emit WebSocket event for real-time balance update
      try {
        const balanceResult = await this.db.query(
          'SELECT balance FROM accounts WHERE user_id = $1',
          [userId],
        );
        const balance = mapQueryRow<{ balance: number }>(balanceResult, {
          numberFields: ['balance'],
        });
        if (balance) {
          this.walletGateway.emitBalanceUpdate(
            userId,
            balance.balance,
          );
          this.walletGateway.emitDepositStatusUpdate(
            userId,
            checkoutRequestId,
            'completed',
          );
        }
      } catch (error) {
        this.logger.error('Failed to emit WebSocket update', error);
      }

      this.logger.log(`Deposit completed: Transaction ${result.transactionId}`);
    } else if (transactionType === 'withdrawal') {
      // Complete withdrawal through ledger
      const result = await this.ledger.processWithdrawal(
        userId,
        amount,
        checkoutRequestId,
        `M-Pesa withdrawal - Receipt: ${mpesaReceiptNumber}`,
      );

      // Update callback record
      await this.db.query(
        `UPDATE mpesa_callbacks 
         SET transaction_id = $1,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{ledger_processed}',
               'true'::jsonb
             )
         WHERE id = $2`,
        [result.transactionId, callbackId],
      );

      // Send notification
      try {
        const userResult = await this.db.query(
          'SELECT email, phone FROM users WHERE id = $1',
          [userId],
        );
        const user = mapQueryRow<{ email: string | null; phone: string | null }>(userResult);
        if (user) {
          await this.notification.sendWithdrawalReceipt(
            user.email,
            user.phone,
            amount,
            checkoutRequestId,
            mpesaReceiptNumber,
          );
        }
      } catch (error) {
        this.logger.error('Failed to send withdrawal notification', error);
      }

      // Record usage for limits tracking
      try {
        await this.limits.recordUsage(userId, 'withdrawal', parseFloat(amount));
      } catch (error) {
        this.logger.error('Failed to record withdrawal usage', error);
      }

      // Emit WebSocket event for real-time balance update
      try {
        const balanceResult = await this.db.query(
          'SELECT balance FROM accounts WHERE user_id = $1',
          [userId],
        );
        const balance = mapQueryRow<{ balance: number }>(balanceResult, {
          numberFields: ['balance'],
        });
        if (balance) {
          this.walletGateway.emitBalanceUpdate(
            userId,
            balance.balance,
          );
        }
      } catch (error) {
        this.logger.error('Failed to emit WebSocket update', error);
      }

      this.logger.log(
        `Withdrawal completed: Transaction ${result.transactionId}`,
      );
    }
  }

  /**
   * Handle failed callbacks and mark them for manual review
   */
  async processFailedCallbacks(): Promise<void> {
    const failed = await this.db.query(
      `SELECT * FROM mpesa_callbacks 
       WHERE status = 'failed' 
       AND metadata->>'reviewed' IS NULL
       ORDER BY callback_received_at DESC
       LIMIT 50`,
    );

    for (const callback of failed.rows) {
      // Mark as reviewed
      await this.db.query(
        `UPDATE mpesa_callbacks 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{reviewed}',
           'true'::jsonb
         )
         WHERE id = $1`,
        [callback.id],
      );

      this.logger.warn(
        `Failed callback: ${callback.checkout_request_id} - ${callback.result_desc}`,
      );
    }
  }

  /**
   * Check for stuck pending callbacks (timeout after 5 minutes)
   */
  async processStuckCallbacks(): Promise<void> {
    const stuck = await this.db.query(
      `SELECT * FROM mpesa_callbacks 
       WHERE status = 'pending' 
       AND initiated_at < NOW() - INTERVAL '5 minutes'
       ORDER BY initiated_at ASC
       LIMIT 50`,
    );

    for (const callback of stuck.rows) {
      // Mark as cancelled
      await this.db.query(
        `UPDATE mpesa_callbacks 
         SET status = 'cancelled',
             result_desc = 'Timeout - no callback received',
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{auto_cancelled}',
               'true'::jsonb
             )
         WHERE id = $1`,
        [callback.id],
      );

      this.logger.warn(
        `Cancelled stuck callback: ${callback.checkout_request_id}`,
      );
    }
  }

  /**
   * Daily reconciliation report
   */
  async generateDailyReport(): Promise<any> {
    const report = await this.db.query(
      `SELECT 
        transaction_type,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        SUM(amount) FILTER (WHERE status = 'completed') as total_amount
       FROM mpesa_callbacks
       WHERE initiated_at >= CURRENT_DATE
       GROUP BY transaction_type`,
    );

    return report.rows;
  }

  /**
   * Process refunds for failed deposits
   * Marks them as refunded in the database
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processRefunds(): Promise<void> {
    this.logger.log('Processing refunds for failed deposits...');

    // Get all failed deposit callbacks that need refunds
    const failedDeposits = await this.db.query(
      `SELECT * FROM mpesa_callbacks 
       WHERE transaction_type = 'deposit'
       AND status = 'failed'
       AND result_code != 0
       AND metadata->>'refunded' IS NULL
       AND mpesa_receipt_number IS NOT NULL
       ORDER BY callback_received_at ASC
       LIMIT 20`,
    );

    this.logger.log(
      `Found ${failedDeposits.rowCount} failed deposits to refund`,
    );

    for (const callback of failedDeposits.rows) {
      try {
        await this.processRefund(callback);
      } catch (error) {
        this.logger.error(
          `Failed to process refund for ${callback.checkout_request_id}`,
          error,
        );
      }
    }
  }

  /**
   * Process a single refund
   */
  private async processRefund(callback: any): Promise<void> {
    const {
      id: callbackId,
      user_id: userId,
      amount,
      mpesa_receipt_number: mpesaReceiptNumber,
      checkout_request_id: checkoutRequestId,
      phone_number: phoneNumber,
    } = callback;

    this.logger.log(`Processing refund for ${checkoutRequestId}`);

    // Convert amount to number (it comes as string from database)
    const numericAmount = parseFloat(amount);

    // In a real scenario, you'd trigger M-Pesa B2C transaction here
    // For now, we'll just mark it as refund initiated

    // Update callback record with refund status
    await this.db.query(
      `UPDATE mpesa_callbacks 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{refunded}',
         to_jsonb(jsonb_build_object(
           'status', 'initiated',
           'initiated_at', NOW(),
           'amount', $1::numeric
         ))
       )
       WHERE id = $2`,
      [numericAmount, callbackId],
    );

    // Send notification
    try {
      const userResult = await this.db.query(
        'SELECT email, phone FROM users WHERE id = $1',
        [userId],
      );
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        await this.notification.sendDepositReceipt(
          user.email,
          user.phone,
          numericAmount,
          checkoutRequestId,
          `REFUND-${mpesaReceiptNumber}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send refund notification', error);
    }

    this.logger.log(`Refund initiated for ${checkoutRequestId}`);
  }
}
