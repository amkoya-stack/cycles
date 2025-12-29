/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Process, Processor } from '@nestjs/bull';
import { Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import type { Job } from 'bull';
import { DatabaseService } from '../../database/database.service';
import { mapQueryRow } from '../../database/mapper.util';
import { LedgerService } from '../../ledger/ledger.service';
import { MpesaService } from '../../mpesa/mpesa.service';
import { RedisService } from '../../cache/redis.service';
import { NotificationService } from '../notification.service';
import { WalletGateway } from '../wallet.gateway';

export interface DepositJob {
  userId: string;
  amount: number;
  phoneNumber: string;
  externalReference: string;
  idempotencyKey: string;
}

export interface WithdrawalJob {
  userId: string;
  amount: number;
  phoneNumber: string;
  externalReference: string;
  idempotencyKey: string;
}

export interface TransferJob {
  senderUserId: string;
  receiverUserId: string;
  amount: number;
  description: string;
  externalReference: string;
  idempotencyKey: string;
}

export interface ContributionJob {
  userId: string;
  chamaId: string;
  cycleId: string;
  amount: number;
  externalReference: string;
  idempotencyKey: string;
}

export interface PayoutJob {
  payoutId: string;
  chamaId: string;
  recipientUserId: string;
  amount: number;
  externalReference: string;
  idempotencyKey: string;
}

@Processor('financial-transactions')
export class FinancialTransactionProcessor {
  private readonly logger = new Logger(FinancialTransactionProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly mpesa: MpesaService,
    private readonly redis: RedisService,
    private readonly notification: NotificationService,
    @Inject(forwardRef(() => WalletGateway))
    private readonly walletGateway: WalletGateway,
  ) {}

  @Process('deposit')
  async handleDeposit(job: Job<DepositJob>) {
    const { userId, amount, phoneNumber, externalReference, idempotencyKey } =
      job.data;

    this.logger.log(
      `Processing deposit job ${job.id}: ${userId}, ${amount}, ref: ${externalReference}`,
    );

    try {
      // Idempotency check
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `Deposit already processed for idempotency key: ${idempotencyKey}`,
        );
        return existing;
      }

      // Validate amount
      if (amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      // Initiate M-Pesa STK Push
      const stkResponse = await this.mpesa.stkPush({
        phoneNumber,
        amount,
        accountReference: externalReference,
        transactionDesc: `Deposit to wallet`,
      });

      // Create callback tracking record
      await this.mpesa.createCallbackRecord(
        userId,
        phoneNumber,
        amount,
        stkResponse.checkoutRequestId,
        stkResponse.merchantRequestId,
        'deposit',
      );

      const result = {
        checkoutRequestId: stkResponse.checkoutRequestId,
        customerMessage: stkResponse.customerMessage,
        externalReference,
        status: 'pending',
      };

      // Mark idempotency
      await this.markIdempotency(idempotencyKey, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Deposit job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error; // Bull will retry based on configuration
    }
  }

  @Process('withdrawal')
  async handleWithdrawal(job: Job<WithdrawalJob>) {
    const { userId, amount, phoneNumber, externalReference, idempotencyKey } =
      job.data;

    this.logger.log(
      `Processing withdrawal job ${job.id}: ${userId}, ${amount}, ref: ${externalReference}`,
    );

    try {
      // Idempotency check
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `Withdrawal already processed for idempotency key: ${idempotencyKey}`,
        );
        return existing;
      }

      // Validate amount
      if (amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      // Check balance (this will be done in the service, but we validate here too)
      const balanceResult = await this.db.query(
        `SELECT balance FROM accounts 
         WHERE user_id = $1 AND status = 'active' 
         LIMIT 1`,
        [userId],
      );

      if (balanceResult.rows.length === 0) {
        throw new BadRequestException('User account not found');
      }

      // Initiate B2C payment
      const b2cResponse = await this.mpesa.b2cPayment(
        phoneNumber,
        amount,
        `Withdrawal from wallet`,
      );

      const result = {
        conversationId: b2cResponse.ConversationID,
        originatorConversationId: b2cResponse.OriginatorConversationID,
        responseDescription: b2cResponse.ResponseDescription,
        externalReference,
        status: 'pending',
      };

      // Mark idempotency
      await this.markIdempotency(idempotencyKey, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Withdrawal job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('transfer')
  async handleTransfer(job: Job<TransferJob>) {
    const {
      senderUserId,
      receiverUserId,
      amount,
      description,
      externalReference,
      idempotencyKey,
    } = job.data;

    this.logger.log(
      `Processing transfer job ${job.id}: ${senderUserId} -> ${receiverUserId}, ${amount}`,
    );

    try {
      // Idempotency check
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `Transfer already processed for idempotency key: ${idempotencyKey}`,
        );
        return existing;
      }

      // Process transfer through ledger
      const result = await this.ledger.processTransfer(
        senderUserId,
        receiverUserId,
        amount,
        description || 'Wallet transfer',
      );

      // Get balances for WebSocket updates
      let senderBalance: number | null = null;
      let receiverBalance: number | null = null;

      try {
        const senderBalanceResult = await this.db.query(
          `SELECT ABS(balance) as balance FROM accounts 
           WHERE user_id = $1 AND status = 'active' LIMIT 1`,
          [senderUserId],
        );
        const senderAccount = mapQueryRow<{ balance: number }>(senderBalanceResult, {
          numberFields: ['balance'],
        });
        if (senderAccount) {
          senderBalance = Math.abs(senderAccount.balance);
        }

        const receiverBalanceResult = await this.db.query(
          `SELECT ABS(balance) as balance FROM accounts 
           WHERE user_id = $1 AND status = 'active' LIMIT 1`,
          [receiverUserId],
        );
        const receiverAccount = mapQueryRow<{ balance: number }>(receiverBalanceResult, {
          numberFields: ['balance'],
        });
        if (receiverAccount) {
          receiverBalance = Math.abs(receiverAccount.balance);
        }
      } catch (error) {
        this.logger.warn(`Failed to get balances for WebSocket update: ${error.message}`);
      }

      // Emit WebSocket events for both sender and recipient
      try {
        if (senderBalance !== null) {
          this.walletGateway.emitBalanceUpdate(
            senderUserId,
            senderBalance.toString(),
          );
        }
        if (receiverBalance !== null) {
          this.walletGateway.emitBalanceUpdate(
            receiverUserId,
            receiverBalance.toString(),
          );
        }
      } catch (error) {
        this.logger.error('Failed to emit WebSocket updates:', error);
      }

      // Send receipt to sender
      try {
        const senderResult = await this.db.query(
          'SELECT email, phone FROM users WHERE id = $1',
          [senderUserId],
        );
        const recipientNameResult = await this.db.query(
          'SELECT full_name FROM users WHERE id = $1',
          [receiverUserId],
        );

        const sender = mapQueryRow<{ email: string | null; phone: string | null }>(senderResult);
        const recipient = mapQueryRow<{ fullName: string | null }>(recipientNameResult);
        if (sender && recipient) {
          const recipientName = recipient.fullName || 'Unknown';

          await this.notification.sendTransferReceipt(
            sender.email || '',
            sender.phone || '',
            recipientName,
            amount,
            externalReference,
          );
        }
      } catch (error) {
        this.logger.error('Failed to send transfer receipt:', error);
      }

      // Mark idempotency
      await this.markIdempotency(idempotencyKey, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Transfer job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('contribution')
  async handleContribution(job: Job<ContributionJob>) {
    const {
      userId,
      chamaId,
      cycleId,
      amount,
      externalReference,
      idempotencyKey,
    } = job.data;

    this.logger.log(
      `Processing contribution job ${job.id}: user ${userId}, chama ${chamaId}, amount ${amount}`,
    );

    try {
      // Idempotency check
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `Contribution already processed for idempotency key: ${idempotencyKey}`,
        );
        return existing;
      }

      // Process contribution through ledger
      const result = await this.ledger.processContribution(
        userId,
        chamaId,
        amount,
        externalReference,
        `Contribution to chama ${chamaId}`,
      );

      // Get chama name and user details for receipt
      try {
        const chamaResult = await this.db.query(
          'SELECT name FROM chamas WHERE id = $1',
          [chamaId],
        );
        const userResult = await this.db.query(
          'SELECT email, phone FROM users WHERE id = $1',
          [userId],
        );

        const chama = mapQueryRow<{ name: string }>(chamaResult);
        const user = mapQueryRow<{ email: string | null; phone: string | null }>(userResult);
        if (chama && user) {
          const chamaName = chama.name;

          // Get fee amount from transaction metadata if available
          const feeAmount = result.metadata?.feeAmount || 0;

          await this.notification.sendContributionReceipt(
            user.email || '',
            user.phone || '',
            amount,
            externalReference,
            chamaName,
            feeAmount,
          );
        }
      } catch (error) {
        this.logger.error('Failed to send contribution receipt:', error);
      }

      // Mark idempotency
      await this.markIdempotency(idempotencyKey, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Contribution job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('payout')
  async handlePayout(job: Job<PayoutJob>) {
    const {
      payoutId,
      chamaId,
      recipientUserId,
      amount,
      externalReference,
      idempotencyKey,
    } = job.data;

    this.logger.log(
      `Processing payout job ${job.id}: payout ${payoutId}, amount ${amount}`,
    );

    try {
      // Idempotency check
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `Payout already processed for idempotency key: ${idempotencyKey}`,
        );
        return existing;
      }

      // Process payout through ledger
      const result = await this.ledger.processPayout(
        chamaId,
        recipientUserId,
        amount,
        externalReference,
        `Payout from chama ${chamaId}`,
      );

      // Mark idempotency
      await this.markIdempotency(idempotencyKey, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Payout job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async checkIdempotency(idempotencyKey: string): Promise<any | null> {
    if (!idempotencyKey) return null;

    try {
      const cached = await this.redis.get(`idempotency:job:${idempotencyKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Failed to check idempotency: ${error.message}`);
    }

    return null;
  }

  private async markIdempotency(
    idempotencyKey: string,
    result: any,
  ): Promise<void> {
    if (!idempotencyKey) return;

    try {
      await this.redis.set(
        `idempotency:job:${idempotencyKey}`,
        JSON.stringify(result),
        86400, // 24 hours
      );
    } catch (error) {
      this.logger.warn(`Failed to mark idempotency: ${error.message}`);
    }
  }
}
