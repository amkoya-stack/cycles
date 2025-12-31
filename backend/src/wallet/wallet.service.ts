/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { mapQueryResult, mapQueryRow } from '../database/mapper.util';
import { LedgerService } from '../ledger/ledger.service';
import { MpesaService } from '../mpesa/mpesa.service';
import { StatementService } from './statement.service';
import { NotificationService } from './notification.service';
import { WalletGateway } from './wallet.gateway';
import { LimitsService } from './limits.service';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface DepositRequest {
  phoneNumber: string; // Format: 254712345678
  amount: number;
  idempotencyKey?: string;
}

export interface WithdrawRequest {
  phoneNumber: string;
  amount: number;
  idempotencyKey?: string;
}

export interface TransferRequest {
  recipientPhone: string; // Or recipientUserId
  amount: number;
  description?: string;
  idempotencyKey?: string;
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
    @Inject(forwardRef(() => MpesaService))
    private readonly mpesa: MpesaService,
    private readonly statement: StatementService,
    private readonly notification: NotificationService,
    private readonly walletGateway: WalletGateway,
    private readonly limits: LimitsService,
    @InjectQueue('financial-transactions')
    private readonly financialQueue: Queue,
  ) {}

  /**
   * Get user's wallet balance
   */
  async getBalance(userId: string): Promise<number> {
    try {
      console.log(`[getBalance] Getting balance for user: ${userId}`);
      // Get user's account
      const accountResult = await this.db.query(
        "SELECT balance FROM accounts WHERE user_id = $1 AND status = 'active' LIMIT 1",
        [userId],
      );

      console.log(
        `[getBalance] Found ${accountResult.rows.length} accounts for user ${userId}`,
      );

      if (accountResult.rows.length === 0) {
        console.log(`[getBalance] No wallet found for user ${userId}`);
        throw new NotFoundException('Wallet not found');
      }

      // User wallet is a CREDIT account (liability), so balance is negative in our system
      // Display as positive to user
      const account = mapQueryRow<{ balance: number }>(accountResult, {
        numberFields: ['balance'],
      });
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      const balance = Math.abs(account.balance);
      console.log(`[getBalance] User ${userId} balance: ${balance}`);
      return balance;
    } catch (error) {
      console.error(
        `[getBalance] Error getting balance for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Initiate deposit via M-Pesa STK Push (queued)
   */
  async initiateDeposit(userId: string, request: DepositRequest): Promise<any> {
    if (request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Validate against limits
    await this.limits.validateTransaction(userId, 'deposit', request.amount);

    // Generate external reference and idempotency key
    const externalReference = uuidv4();
    const idempotencyKey = request.idempotencyKey || uuidv4();

    // Enqueue deposit job
    const job = await this.financialQueue.add(
      'deposit',
      {
        userId,
        amount: request.amount,
        phoneNumber: request.phoneNumber,
        externalReference,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey, // Use idempotency key as job ID for deduplication
        removeOnComplete: true,
      },
    );

    return {
      jobId: job.id,
      status: 'queued',
      externalReference,
      idempotencyKey,
      message: 'Deposit request queued for processing',
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

    // Emit balance update via WebSocket
    try {
      const newBalance = await this.getBalance(userId);
      this.walletGateway.emitBalanceUpdate(userId, newBalance.toString());
    } catch (error) {
      console.error('Failed to emit balance update:', error);
    }

    // Send receipt notifications
    try {
      const userResult = await this.db.query(
        'SELECT email, phone FROM users WHERE id = $1',
        [userId],
      );
      const user = mapQueryRow<{ email: string | null; phone: string | null }>(
        userResult,
      );
      if (user) {
        await this.notification.sendDepositReceipt(
          user.email || '',
          user.phone || '',
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
   * Initiate withdrawal to M-Pesa (queued)
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

    // Generate external reference and idempotency key
    const externalReference = uuidv4();
    const idempotencyKey = request.idempotencyKey || uuidv4();

    // Enqueue withdrawal job
    const job = await this.financialQueue.add(
      'withdrawal',
      {
        userId,
        amount: request.amount,
        phoneNumber: request.phoneNumber,
        externalReference,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey,
        removeOnComplete: true,
      },
    );

    return {
      jobId: job.id,
      status: 'queued',
      externalReference,
      idempotencyKey,
      message: 'Withdrawal request queued for processing',
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
      const user = mapQueryRow<{
        email: string | null;
        phone: string | null;
        fullName: string | null;
      }>(userResult);
      if (user) {
        await this.notification.sendWithdrawalReceipt(
          user.email || '',
          user.phone || '',
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
   * Internal wallet-to-wallet transfer (queued)
   */
  async transfer(senderId: string, request: TransferRequest): Promise<any> {
    if (request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Validate against limits
    await this.limits.validateTransaction(senderId, 'transfer', request.amount);

    // Get recipient by phone, email, or name
    const identifier = request.recipientPhone;
    const recipientResult = await this.db.query(
      `SELECT id FROM users 
       WHERE phone = $1 
          OR email = $1 
          OR LOWER(full_name) = LOWER($1)
       LIMIT 1`,
      [identifier],
    );

    if (recipientResult.rows.length === 0) {
      throw new BadRequestException(
        'Recipient not found. Please check the phone number, email, or name.',
      );
    }

    const recipient = mapQueryRow<{ id: string }>(recipientResult);
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }
    const recipientId = recipient.id;

    // Check sender balance
    const balance = await this.getBalance(senderId);
    if (balance < request.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Generate external reference and idempotency key
    const externalReference = uuidv4();
    const idempotencyKey = request.idempotencyKey || uuidv4();

    // Enqueue transfer job
    const job = await this.financialQueue.add(
      'transfer',
      {
        senderUserId: senderId,
        receiverUserId: recipientId,
        amount: request.amount,
        description: request.description || 'Wallet transfer',
        externalReference,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey,
        removeOnComplete: true,
      },
    );

    return {
      jobId: job.id,
      status: 'queued',
      externalReference,
      idempotencyKey,
      message: 'Transfer queued for processing',
    };
  }

  /**
   * Get job status for queued financial transactions
   */
  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.financialQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();

    return {
      id: job.id,
      status: state,
      progress: job.progress(),
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
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
        CASE 
          WHEN tc.code = 'TRANSFER' AND e.direction = 'debit' THEN 
            'Transfer to ' || COALESCE((
              SELECT u.full_name 
              FROM entries e2 
              JOIN accounts a2 ON e2.account_id = a2.id 
              JOIN users u ON a2.user_id = u.id 
              WHERE e2.transaction_id = t.id AND e2.direction = 'credit'
              LIMIT 1
            ), 'Unknown')
          WHEN tc.code = 'TRANSFER' AND e.direction = 'credit' THEN 
            'Received from ' || COALESCE((
              SELECT u.full_name 
              FROM entries e2 
              JOIN accounts a2 ON e2.account_id = a2.id 
              JOIN users u ON a2.user_id = u.id 
              WHERE e2.transaction_id = t.id AND e2.direction = 'debit'
              LIMIT 1
            ), 'Unknown')
          ELSE t.description
        END as description,
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
      JOIN transaction_codes tc ON t.transaction_code_id = tc.id
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

    // Map database rows to TypeScript objects with proper types
    const transactions = mapQueryResult<any>(result, {
      dateFields: ['createdAt', 'completedAt'],
      numberFields: ['amount', 'balanceBefore', 'balanceAfter'],
    });

    return {
      transactions,
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

    // Map database row to TypeScript object with proper types
    const transaction = mapQueryRow<any>(result, {
      dateFields: ['createdAt', 'completedAt'],
      jsonFields: ['entries'], // Parse JSONB entries array
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
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

    return mapQueryRow<any>(result, {
      dateFields: ['createdAt', 'completedAt'],
    });
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

    const callback = mapQueryRow<any>(callbackResult, {
      dateFields: ['createdAt', 'completedAt'],
      numberFields: ['amount'],
    });
    if (!callback) {
      throw new NotFoundException('Transaction not found');
    }

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

  /**
   * Create a fund request
   */
  async createFundRequest(
    requesterId: string,
    dto: {
      amount: number;
      description?: string;
      recipientId?: string;
      chamaId?: string;
      requestType: 'member' | 'chama';
    },
  ) {
    console.log('Creating fund request:', { requesterId, dto });

    // Validate request type and recipient
    if (dto.requestType === 'member' && !dto.recipientId) {
      throw new BadRequestException(
        'Recipient ID is required for member requests',
      );
    }
    if (dto.requestType === 'chama' && !dto.chamaId) {
      throw new BadRequestException('Chama ID is required for chama requests');
    }

    // Validate that requester and recipient are different
    if (dto.requestType === 'member' && dto.recipientId === requesterId) {
      throw new BadRequestException('Cannot request funds from yourself');
    }

    // For member requests, verify both users are in the same chama
    if (dto.requestType === 'member') {
      const sharedChamas = await this.db.query(
        `SELECT COUNT(DISTINCT c.id) as shared_chamas
         FROM chama_members cm1
         JOIN chama_members cm2 ON cm1.chama_id = cm2.chama_id
         WHERE cm1.user_id = $1 AND cm2.user_id = $2 
           AND cm1.status = 'active' AND cm2.status = 'active'`,
        [requesterId, dto.recipientId],
      );

      const sharedChamasData = mapQueryRow<{ sharedChamas: number }>(
        sharedChamas,
        {
          numberFields: ['sharedChamas'],
        },
      );
      if (!sharedChamasData || sharedChamasData.sharedChamas === 0) {
        throw new BadRequestException(
          'You can only request funds from members in your chamas',
        );
      }
    }

    // For chama requests, verify user is a member
    if (dto.requestType === 'chama') {
      const membership = await this.db.query(
        'SELECT id FROM chama_members WHERE user_id = $1 AND chama_id = $2 AND status = $3',
        [requesterId, dto.chamaId, 'active'],
      );

      if (membership.rowCount === 0) {
        throw new BadRequestException(
          'You must be an active member to request funds from this chama',
        );
      }
    }

    // Create the fund request
    const result = await this.db.query(
      `INSERT INTO fund_requests (
        requester_id, recipient_id, chama_id, amount, description, request_type
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        requesterId,
        dto.recipientId || null,
        dto.chamaId || null,
        dto.amount,
        dto.description || `Request for ${dto.amount} KES`,
        dto.requestType,
      ],
    );

    const fundRequest = mapQueryRow<any>(result, {
      dateFields: ['createdAt', 'updatedAt'],
      numberFields: ['amount'],
    });
    console.log('Fund request created:', fundRequest);
    return fundRequest!;
  }

  /**
   * Get fund requests for a user (received by them)
   */
  async getFundRequests(userId: string, status?: string) {
    let query = `
      SELECT 
        fr.*,
        u.full_name as requester_name,
        u.profile_photo_url as requester_avatar,
        u.phone as requester_phone,
        c.name as chama_name,
        c.cover_image as chama_avatar
      FROM fund_requests fr
      JOIN users u ON fr.requester_id = u.id
      LEFT JOIN chamas c ON fr.chama_id = c.id
      WHERE (
        (fr.request_type = 'member' AND fr.recipient_id = $1) OR
        (fr.request_type = 'chama' AND fr.chama_id IN (
          SELECT chama_id FROM chama_members 
          WHERE user_id = $1 AND status = 'active' AND role IN ('admin', 'treasurer')
        ))
      )
    `;

    const params = [userId];

    if (status) {
      query += ' AND fr.status = $2';
      params.push(status);
    }

    query += ' ORDER BY fr.created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get sent fund requests by a user
   */
  async getSentFundRequests(userId: string) {
    const result = await this.db.query(
      `SELECT 
        fr.*,
        CASE 
          WHEN fr.request_type = 'member' THEN u.full_name
          ELSE c.name
        END as recipient_name,
        CASE 
          WHEN fr.request_type = 'member' THEN u.profile_photo_url
          ELSE c.cover_image
        END as recipient_avatar
      FROM fund_requests fr
      LEFT JOIN users u ON fr.recipient_id = u.id
      LEFT JOIN chamas c ON fr.chama_id = c.id
      WHERE fr.requester_id = $1
      ORDER BY fr.created_at DESC`,
      [userId],
    );

    return result.rows;
  }

  /**
   * Respond to a fund request (approve/decline)
   */
  async respondToFundRequest(
    userId: string,
    requestId: string,
    action: 'approve' | 'decline',
  ) {
    console.log('Responding to fund request:', { userId, requestId, action });

    // Get the fund request
    const requestResult = await this.db.query(
      'SELECT * FROM fund_requests WHERE id = $1',
      [requestId],
    );

    if (requestResult.rowCount === 0) {
      throw new NotFoundException('Fund request not found');
    }

    const fundRequest = mapQueryRow<any>(requestResult, {
      dateFields: ['createdAt', 'updatedAt', 'respondedAt'],
      numberFields: ['amount'],
      booleanFields: ['isApproved'],
    });
    if (!fundRequest) {
      throw new NotFoundException('Fund request not found');
    }

    // Validate user can respond to this request
    let canRespond = false;

    if (
      fundRequest.request_type === 'member' &&
      fundRequest.recipient_id === userId
    ) {
      canRespond = true;
    } else if (fundRequest.request_type === 'chama') {
      // Check if user is admin/treasurer of the chama
      const membership = await this.db.query(
        'SELECT role FROM chama_members WHERE user_id = $1 AND chama_id = $2 AND status = $3',
        [userId, fundRequest.chama_id, 'active'],
      );

      const member = mapQueryRow<{ role: string }>(membership);
      if (member && ['admin', 'treasurer'].includes(member.role)) {
        canRespond = true;
      }
    }

    if (!canRespond) {
      throw new BadRequestException(
        'You are not authorized to respond to this request',
      );
    }

    // Check if request is still pending
    if (fundRequest.status !== 'pending') {
      throw new BadRequestException('Request has already been processed');
    }

    const newStatus = action === 'approve' ? 'approved' : 'declined';

    // If approving, process the transfer
    if (action === 'approve') {
      try {
        if (fundRequest.request_type === 'member') {
          // Transfer from user's wallet to requester's wallet
          await this.ledger.processTransfer(
            userId,
            fundRequest.requester_id,
            fundRequest.amount,
            `Fund request approved: ${fundRequest.description}`,
          );
        } else if (fundRequest.request_type === 'chama') {
          // Transfer from chama to user's wallet (payout)
          await this.ledger.processPayout(
            fundRequest.chama_id,
            fundRequest.requester_id,
            fundRequest.amount,
            `Fund request approved: ${fundRequest.description}`,
            uuidv4(),
          );
        }
      } catch (error) {
        console.error('Failed to process fund transfer:', error);
        throw new BadRequestException('Insufficient funds or transfer failed');
      }
    }

    // Update the request status
    await this.db.query(
      'UPDATE fund_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, requestId],
    );

    console.log(`Fund request ${action}d successfully`);
    return {
      message: `Fund request ${action}d successfully`,
      status: newStatus,
    };
  }

  /**
   * Get fund request notifications for a user
   */
  async getFundRequestNotifications(userId: string, isRead?: boolean) {
    let query = `
      SELECT 
        frn.*,
        fr.amount,
        fr.request_type,
        fr.status as request_status
      FROM fund_request_notifications frn
      JOIN fund_requests fr ON frn.fund_request_id = fr.id
      WHERE frn.user_id = $1
    `;

    const params: any[] = [userId];

    if (isRead !== undefined) {
      query += ' AND frn.is_read = $2';
      params.push(isRead);
    }

    query += ' ORDER BY frn.created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Mark fund request notification as read
   */
  async markNotificationAsRead(userId: string, notificationId: string) {
    const result = await this.db.query(
      'UPDATE fund_request_notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { message: 'Notification marked as read' };
  }
}
