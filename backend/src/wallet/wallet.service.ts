/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { MpesaService } from '../mpesa/mpesa.service';
import { StatementService } from './statement.service';
import { NotificationService } from './notification.service';
import { WalletGateway } from './wallet.gateway';
import { LimitsService } from './limits.service';
import { v4 as uuidv4 } from 'uuid';

export interface DepositRequest {
  phoneNumber: string; // Format: 254712345678
  amount: number;
}

export interface WithdrawRequest {
  phoneNumber: string;
  amount: number;
}

export interface TransferRequest {
  recipientPhone: string; // Or recipientUserId
  amount: number;
  description?: string;
}

export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  type?: 'deposit' | 'withdrawal' | 'transfer' | 'contribution' | 'payout';
  status?: 'pending' | 'completed' | 'failed';
  limit?: number;
  offset?: number;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly mpesa: MpesaService,
    private readonly statement: StatementService,
    private readonly notification: NotificationService,
    private readonly walletGateway: WalletGateway,
    private readonly limits: LimitsService,
  ) {}

  /**
   * Get user's wallet balance
   */
  async getBalance(userId: string): Promise<number> {
    // Get user's account
    const accountResult = await this.db.query(
      "SELECT balance FROM accounts WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [userId],
    );

    if (accountResult.rows.length === 0) {
      throw new NotFoundException('Wallet not found');
    }

    // User wallet is a CREDIT account (liability), so balance is negative in our system
    // Display as positive to user
    return Math.abs(accountResult.rows[0].balance);
  }

  /**
   * Initiate deposit via M-Pesa STK Push
   */
  async initiateDeposit(userId: string, request: DepositRequest): Promise<any> {
    if (request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Validate against limits
    await this.limits.validateTransaction(userId, 'deposit', request.amount);

    // Generate external reference for idempotency
    const externalReference = uuidv4();

    // Initiate STK Push
    const stkResponse = await this.mpesa.stkPush({
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      accountReference: externalReference,
      transactionDesc: `Deposit to wallet`,
    });

    // Create callback tracking record
    await this.mpesa.createCallbackRecord(
      userId,
      request.phoneNumber,
      request.amount,
      stkResponse.checkoutRequestId,
      stkResponse.merchantRequestId,
      'deposit',
    );

    return {
      checkoutRequestId: stkResponse.checkoutRequestId,
      customerMessage: stkResponse.customerMessage,
      externalReference,
    };
  }

  /**
   * Complete deposit after successful M-Pesa callback
   * Called by M-Pesa callback handler
   */
  async completeDeposit(
    userId: string,
    amount: number,
    mpesaReceiptNumber: string,
    externalReference: string,
  ): Promise<any> {
    // Process deposit through ledger
    const result = await this.ledger.processDeposit(
      userId,
      amount,
      externalReference,
      `Deposit from M-Pesa: ${mpesaReceiptNumber}`,
    );

    // Send receipt notifications
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
          amount,
          externalReference,
          mpesaReceiptNumber,
        );
      }
    } catch (error) {
      // Log but don't fail the transaction
      console.error('Failed to send deposit receipt:', error);
    }

    return result;
  }

  /**
   * Initiate withdrawal to M-Pesa
   */
  async initiateWithdrawal(
    userId: string,
    request: WithdrawRequest,
  ): Promise<any> {
    if (request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Validate against limits
    await this.limits.validateTransaction(userId, 'withdrawal', request.amount);

    // Check balance
    const balance = await this.getBalance(userId);
    if (balance < request.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Generate external reference
    const externalReference = uuidv4();

    // Initiate B2C payment
    const b2cResponse = await this.mpesa.b2cPayment(
      request.phoneNumber,
      request.amount,
      `Withdrawal from wallet`,
    );

    // TODO: Create pending withdrawal transaction
    // Process through ledger after B2C callback confirms success

    return {
      conversationId: b2cResponse.ConversationID,
      originatorConversationId: b2cResponse.OriginatorConversationID,
      responseDescription: b2cResponse.ResponseDescription,
      externalReference,
    };
  }

  /**
   * Complete withdrawal after successful B2C callback
   */
  async completeWithdrawal(
    userId: string,
    amount: number,
    mpesaReceiptNumber: string,
    externalReference: string,
  ): Promise<any> {
    // Process withdrawal through ledger
    const result = await this.ledger.processWithdrawal(
      userId,
      amount,
      externalReference,
      `Withdrawal to M-Pesa: ${mpesaReceiptNumber}`,
    );

    // Send receipt notifications
    try {
      const userResult = await this.db.query(
        'SELECT email, phone FROM users WHERE id = $1',
        [userId],
      );
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        await this.notification.sendWithdrawalReceipt(
          user.email,
          user.phone,
          amount,
          externalReference,
          mpesaReceiptNumber,
        );
      }
    } catch (error) {
      console.error('Failed to send withdrawal receipt:', error);
    }

    return result;
  }

  /**
   * Internal wallet-to-wallet transfer
   */
  async transfer(senderId: string, request: TransferRequest): Promise<any> {
    if (request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Validate against limits
    await this.limits.validateTransaction(senderId, 'transfer', request.amount);

    // Get recipient by phone number
    const recipientResult = await this.db.query(
      'SELECT id FROM users WHERE phone = $1 LIMIT 1',
      [request.recipientPhone],
    );

    if (recipientResult.rows.length === 0) {
      throw new BadRequestException('Recipient not found');
    }

    const recipientId = recipientResult.rows[0].id;

    // Check sender balance
    const balance = await this.getBalance(senderId);
    if (balance < request.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Process transfer through ledger
    const externalReference = uuidv4();
    const result = await this.ledger.processTransfer(
      senderId,
      recipientId,
      request.amount,
      request.description || 'Wallet transfer',
    );

    // Send receipt to sender
    try {
      const senderResult = await this.db.query(
        'SELECT email, phone FROM users WHERE id = $1',
        [senderId],
      );
      const recipientNameResult = await this.db.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [recipientId],
      );

      if (senderResult.rows.length > 0 && recipientNameResult.rows.length > 0) {
        const sender = senderResult.rows[0];
        const recipient = recipientNameResult.rows[0];
        const recipientName =
          `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim();

        await this.notification.sendTransferReceipt(
          sender.email,
          sender.phone,
          recipientName || request.recipientPhone,
          request.amount,
          externalReference,
        );
      }
    } catch (error) {
      console.error('Failed to send transfer receipt:', error);
    }

    // Emit WebSocket events for both sender and recipient
    try {
      const senderBalance = await this.getBalance(senderId);
      const recipientBalance = await this.getBalance(recipientId);
      this.walletGateway.emitBalanceUpdate(senderId, senderBalance.toString());
      this.walletGateway.emitBalanceUpdate(
        recipientId,
        recipientBalance.toString(),
      );
    } catch (error) {
      console.error('Failed to emit WebSocket updates:', error);
    }

    return result;
  }

  /**
   * Get transaction history with filters
   */
  async getTransactionHistory(
    userId: string,
    filters: TransactionFilter,
  ): Promise<any> {
    // Set user context for RLS
    await this.db.setUserContext(userId);

    let query = `
      SELECT 
        t.id,
        t.reference,
        t.description,
        t.status,
        t.created_at,
        t.completed_at,
        tc.code as transaction_type,
        tc.name as transaction_name,
        e.amount,
        e.direction,
        e.balance_before,
        e.balance_after
      FROM transactions t
      JOIN transaction_codes tc ON t.code_id = tc.id
      JOIN entries e ON t.id = e.transaction_id
      JOIN accounts a ON e.account_id = a.id
      WHERE a.user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    // Apply filters
    if (filters.startDate) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.type) {
      query += ` AND tc.code = $${paramIndex}`;
      params.push(filters.type.toUpperCase());
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ' ORDER BY t.created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const result = await this.db.query(query, params);

    // Clear context
    await this.db.clearContext();

    return {
      transactions: result.rows,
      count: result.rowCount,
    };
  }

  /**
   * Get single transaction details
   */
  async getTransactionDetails(
    userId: string,
    transactionId: string,
  ): Promise<any> {
    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        t.id,
        t.reference,
        t.external_reference,
        t.description,
        t.status,
        t.created_at,
        t.completed_at,
        tc.code as transaction_type,
        tc.name as transaction_name,
        json_agg(json_build_object(
          'account_id', a.id,
          'account_name', a.name,
          'direction', e.direction,
          'amount', e.amount,
          'balance_before', e.balance_before,
          'balance_after', e.balance_after
        )) as entries
      FROM transactions t
      JOIN transaction_codes tc ON t.code_id = tc.id
      JOIN entries e ON t.id = e.transaction_id
      JOIN accounts a ON e.account_id = a.id
      WHERE t.id = $1
      GROUP BY t.id, tc.code, tc.name`,
      [transactionId],
    );

    await this.db.clearContext();

    if (result.rows.length === 0) {
      throw new NotFoundException('Transaction not found');
    }

    return result.rows[0];
  }

  /**
   * Generate account statement
   */
  async generateStatement(
    userId: string,
    options: { startDate: Date; endDate: Date; format: 'pdf' | 'csv' },
  ): Promise<any> {
    if (options.format === 'pdf') {
      const pdfBuffer = await this.statement.generatePDFStatement({
        userId,
        startDate: options.startDate,
        endDate: options.endDate,
      });

      return {
        format: 'pdf',
        data: pdfBuffer.toString('base64'),
        filename: `statement-${userId}-${Date.now()}.pdf`,
      };
    } else {
      const csvData = await this.statement.generateCSVStatement({
        userId,
        startDate: options.startDate,
        endDate: options.endDate,
      });

      return {
        format: 'csv',
        data: csvData,
        filename: `statement-${userId}-${Date.now()}.csv`,
      };
    }
  }

  /**
   * Check deposit status
   */
  async checkDepositStatus(
    userId: string,
    checkoutRequestId: string,
  ): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        id,
        checkout_request_id,
        amount,
        status,
        result_desc,
        mpesa_receipt_number,
        transaction_id,
        initiated_at,
        callback_received_at
       FROM mpesa_callbacks
       WHERE checkout_request_id = $1 AND user_id = $2`,
      [checkoutRequestId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Deposit request not found');
    }

    return result.rows[0];
  }

  /**
   * Get failed transactions for a user
   */
  async getFailedTransactions(userId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT 
        id,
        checkout_request_id,
        amount,
        status,
        result_code,
        result_desc,
        mpesa_receipt_number,
        transaction_type,
        initiated_at,
        callback_received_at,
        metadata
       FROM mpesa_callbacks
       WHERE user_id = $1 
       AND (status = 'failed' OR result_code != 0)
       ORDER BY callback_received_at DESC
       LIMIT 50`,
      [userId],
    );

    return result.rows;
  }

  /**
   * Request refund for a failed transaction
   */
  async requestRefund(userId: string, callbackId: string): Promise<any> {
    // Verify the callback belongs to this user and is failed
    const callbackResult = await this.db.query(
      `SELECT * FROM mpesa_callbacks 
       WHERE id = $1 AND user_id = $2`,
      [callbackId, userId],
    );

    if (callbackResult.rows.length === 0) {
      throw new NotFoundException('Transaction not found');
    }

    const callback = callbackResult.rows[0];

    if (callback.status !== 'failed' && callback.result_code === 0) {
      throw new BadRequestException('Only failed transactions can be refunded');
    }

    // Check if already refunded
    if (callback.metadata?.refunded) {
      throw new BadRequestException('Refund already requested');
    }

    // Mark for refund
    await this.db.query(
      `UPDATE mpesa_callbacks 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{refund_requested}',
         to_jsonb(jsonb_build_object(
           'requested_at', NOW(),
           'requested_by', $2::text
         ))
       )
       WHERE id = $1`,
      [callbackId, userId],
    );

    return {
      message: 'Refund request submitted successfully',
      callbackId,
      status: 'pending_review',
    };
  }
}
