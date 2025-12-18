/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
// ==========================================
// LEDGER SERVICE
// backend/src/ledger/ledger.service.ts
// ==========================================

import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

// Types
export enum AccountNormality {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum EntryDirection {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export interface CreateTransactionDto {
  transactionCode: string;
  amount: number;
  description: string;
  initiatedBy?: string;
  externalReference?: string;
  metadata?: any;
}

export interface TransactionEntry {
  accountId: string;
  direction: EntryDirection;
  amount: number;
  description?: string;
}

@Injectable()
export class LedgerService {
  constructor(private readonly db: DatabaseService) {}

  // ==========================================
  // ACCOUNT OPERATIONS
  // ==========================================

  /**
   * Create a user wallet account
   */
  async createUserWallet(userId: string, userName: string): Promise<any> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Get ledger ID and account type
      const ledgerResult = await client.query(
        'SELECT id FROM ledgers WHERE is_active = true LIMIT 1',
      );
      if (ledgerResult.rows.length === 0) {
        throw new BadRequestException(
          'No active ledger found. Please run migrations.',
        );
      }
      const ledgerId = ledgerResult.rows[0].id;

      const accountTypeResult = await client.query(
        "SELECT id FROM account_types WHERE code = 'USER_WALLET'",
      );
      if (accountTypeResult.rows.length === 0) {
        throw new BadRequestException(
          'USER_WALLET account type not found. Please run migrations.',
        );
      }
      const accountTypeId = accountTypeResult.rows[0].id;

      // Generate unique account number
      const accountNumber = `UW${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Create account
      const result = await client.query(
        `INSERT INTO accounts (
          ledger_id, account_type_id, account_number, name, user_id, status
        ) VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *`,
        [
          ledgerId,
          accountTypeId,
          accountNumber,
          `${userName}'s Wallet`,
          userId,
        ],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a chama wallet account
   */
  async createChamaWallet(chamaId: string, chamaName: string): Promise<any> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const ledgerResult = await client.query(
        'SELECT id FROM ledgers WHERE is_active = true LIMIT 1',
      );
      const ledgerId = ledgerResult.rows[0].id;

      const accountTypeResult = await client.query(
        "SELECT id FROM account_types WHERE code = 'CHAMA_WALLET'",
      );
      const accountTypeId = accountTypeResult.rows[0].id;

      const accountNumber = `CW${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const result = await client.query(
        `INSERT INTO accounts (
          ledger_id, account_type_id, account_number, name, chama_id, status
        ) VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *`,
        [
          ledgerId,
          accountTypeId,
          accountNumber,
          `${chamaName}'s Wallet`,
          chamaId,
        ],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT balance FROM accounts WHERE id = $1',
      [accountId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Account not found');
    }

    return parseFloat(result.rows[0].balance);
  }

  /**
   * Get user account by user ID
   */
  async getUserAccount(userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT a.*, at.normality 
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       WHERE a.user_id = $1 AND at.code = 'USER_WALLET' AND a.status = 'active'
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('User account not found');
    }

    return result.rows[0];
  }

  /**
   * Get chama account by chama ID
   */
  async getChamaAccount(chamaId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT a.*, at.normality 
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       WHERE a.chama_id = $1 AND at.code = 'CHAMA_WALLET' AND a.status = 'active'
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [chamaId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Chama account not found');
    }

    return result.rows[0];
  }

  /**
   * Get system account by code
   */
  async getSystemAccount(accountCode: string): Promise<any> {
    const result = await this.db.query(
      `SELECT a.*, at.normality 
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       WHERE at.code = $1`,
      [accountCode],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException(`System account ${accountCode} not found`);
    }

    return result.rows[0];
  }

  // ==========================================
  // TRANSACTION OPERATIONS
  // ==========================================

  /**
   * Process a deposit transaction
   * User deposits money from external source (M-Pesa, Bank) into their wallet
   *
   * Accounting:
   * DR: Cash (Platform receives money)
   * CR: User Wallet (User's liability increases)
   */
  async processDeposit(
    userId: string,
    amount: number,
    externalReference: string,
    description: string,
  ): Promise<any> {
    // Idempotency: if an external reference has already been processed for DEPOSIT, return existing
    if (externalReference) {
      const existing = await this.db.query(
        `SELECT t.*
         FROM transactions t
         JOIN transaction_codes tc ON t.transaction_code_id = tc.id
         WHERE tc.code = 'DEPOSIT' AND t.external_reference = $1 AND t.status = 'completed'
         LIMIT 1`,
        [externalReference],
      );
      if (existing.rows.length > 0) {
        return existing.rows[0];
      }
    }
    const reference = `DEP-${uuidv4()}`;

    // Get accounts
    const cashAccount = await this.getSystemAccount('CASH');
    const userAccount = await this.getUserAccount(userId);

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be greater than zero');
    }

    // Create entries
    const entries: TransactionEntry[] = [
      {
        accountId: cashAccount.id,
        direction: EntryDirection.DEBIT,
        amount: amount,
        description: 'Platform receives deposit',
      },
      {
        accountId: userAccount.id,
        direction: EntryDirection.CREDIT,
        amount: amount,
        description: 'User wallet credited',
      },
    ];

    // Execute transaction
    return await this.executeTransaction(
      {
        transactionCode: 'DEPOSIT',
        amount: amount,
        description: description,
        initiatedBy: userId,
        externalReference: externalReference,
        metadata: { userId, method: 'mpesa' },
      },
      entries,
    );
  }

  /**
   * Process a withdrawal transaction
   * User withdraws money from their wallet to external account (M-Pesa, Bank)
   *
   * Accounting:
   * DR: User Wallet (User's liability decreases)
   * CR: Cash (Platform sends money out)
   */
  async processWithdrawal(
    userId: string,
    amount: number,
    externalReference: string,
    description: string,
  ): Promise<any> {
    // Idempotency: if an external reference has already been processed for WITHDRAWAL, return existing
    if (externalReference) {
      const existing = await this.db.query(
        `SELECT t.*
         FROM transactions t
         JOIN transaction_codes tc ON t.transaction_code_id = tc.id
         WHERE tc.code = 'WITHDRAWAL' AND t.external_reference = $1 AND t.status = 'completed'
         LIMIT 1`,
        [externalReference],
      );
      if (existing.rows.length > 0) {
        return existing.rows[0];
      }
    }
    const reference = `WTH-${uuidv4()}`;

    // Get accounts
    const cashAccount = await this.getSystemAccount('CASH');
    const userAccount = await this.getUserAccount(userId);

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException(
        'Withdrawal amount must be greater than zero',
      );
    }

    // Check sufficient balance
    const currentBalance = await this.getAccountBalance(userAccount.id);
    if (currentBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Create entries
    const entries: TransactionEntry[] = [
      {
        accountId: userAccount.id,
        direction: EntryDirection.DEBIT,
        amount: amount,
        description: 'User wallet debited',
      },
      {
        accountId: cashAccount.id,
        direction: EntryDirection.CREDIT,
        amount: amount,
        description: 'Platform sends withdrawal',
      },
    ];

    // Execute transaction
    return await this.executeTransaction(
      {
        transactionCode: 'WITHDRAWAL',
        amount: amount,
        description: description,
        initiatedBy: userId,
        externalReference: externalReference,
        metadata: { userId, method: 'mpesa' },
      },
      entries,
    );
  }

  /**
   * Process a transfer between users
   * User A sends money to User B
   *
   * Accounting:
   * DR: User A Wallet (Sender's liability decreases)
   * CR: User B Wallet (Receiver's liability increases)
   */
  async processTransfer(
    senderUserId: string,
    receiverUserId: string,
    amount: number,
    description: string,
  ): Promise<any> {
    const reference = `TRF-${uuidv4()}`;

    // Get accounts
    const senderAccount = await this.getUserAccount(senderUserId);
    const receiverAccount = await this.getUserAccount(receiverUserId);

    // Validate
    if (amount <= 0) {
      throw new BadRequestException(
        'Transfer amount must be greater than zero',
      );
    }

    if (senderUserId === receiverUserId) {
      throw new BadRequestException('Cannot transfer to same account');
    }

    // Check balance
    const senderBalance = await this.getAccountBalance(senderAccount.id);
    if (senderBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Create entries
    const entries: TransactionEntry[] = [
      {
        accountId: senderAccount.id,
        direction: EntryDirection.DEBIT,
        amount: amount,
        description: 'Transfer sent',
      },
      {
        accountId: receiverAccount.id,
        direction: EntryDirection.CREDIT,
        amount: amount,
        description: 'Transfer received',
      },
    ];

    // Execute transaction
    return await this.executeTransaction(
      {
        transactionCode: 'TRANSFER',
        amount: amount,
        description: description,
        initiatedBy: senderUserId,
        metadata: { senderUserId, receiverUserId },
      },
      entries,
    );
  }

  /**
   * Process a contribution to chama with 4.5% fee
   * User contributes to chama, platform charges 4.5% fee
   *
   * Accounting:
   * DR: User Wallet (User's liability decreases by total)
   * CR: Chama Wallet (Chama receives net amount)
   * CR: Revenue (Platform earns fee)
   */
  async processContribution(
    userId: string,
    chamaId: string,
    amount: number,
    description: string,
    externalReference?: string,
  ): Promise<any> {
    // Idempotency: Check if contribution already processed
    if (externalReference) {
      const existing = await this.db.query(
        `SELECT t.*
         FROM transactions t
         JOIN transaction_codes tc ON t.transaction_code_id = tc.id
         WHERE tc.code = 'CONTRIBUTION' AND t.external_reference = $1 AND t.status = 'completed'
         LIMIT 1`,
        [externalReference],
      );
      if (existing.rows.length > 0) {
        return existing.rows[0]; // Return existing transaction
      }
    }

    const reference = `CTB-${uuidv4()}`;

    // Get accounts
    const userAccount = await this.getUserAccount(userId);
    const chamaAccount = await this.getChamaAccount(chamaId);
    const revenueAccount = await this.getSystemAccount('REVENUE_FEES');

    // Calculate fee (4.5%) with proper rounding to avoid floating-point errors
    const feePercentage = 4.5;
    const feeAmount = Math.round(amount * feePercentage) / 100; // 4.5% then round to 2 decimals
    const netAmount = amount; // chama receives full amount globally
    const totalAmount = Math.round((amount + feeAmount) * 100) / 100; // Round to 2 decimals

    // Validate
    if (amount <= 0) {
      throw new BadRequestException(
        'Contribution amount must be greater than zero',
      );
    }

    // Check balance
    const userBalance = await this.getAccountBalance(userAccount.id);
    if (userBalance < totalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Create entries
    const entries: TransactionEntry[] = [
      {
        accountId: userAccount.id,
        direction: EntryDirection.DEBIT,
        amount: totalAmount,
        description: 'Contribution + fee debited from user',
      },
      {
        accountId: chamaAccount.id,
        direction: EntryDirection.CREDIT,
        amount: netAmount,
        description: 'Full contribution credited to chama',
      },
      {
        accountId: revenueAccount.id,
        direction: EntryDirection.CREDIT,
        amount: feeAmount,
        description: 'Platform fee earned',
      },
    ];

    // Execute transaction
    return await this.executeTransaction(
      {
        transactionCode: 'CONTRIBUTION',
        amount: totalAmount,
        description: description,
        initiatedBy: userId,
        externalReference: externalReference,
        metadata: {
          userId,
          chamaId,
          feeAmount,
          netAmount,
          chargeFeeTo: 'user',
        },
      },
      entries,
      feeAmount,
    );
  }

  /**
   * Process a payout from chama to member
   * Chama pays out to member (e.g., merry-go-round rotation)
   *
   * Accounting:
   * DR: Chama Wallet (Chama's liability decreases)
   * CR: User Wallet (User's liability increases)
   */
  async processPayout(
    chamaId: string,
    userId: string,
    amount: number,
    description: string,
    externalReference?: string,
  ): Promise<any> {
    // Idempotency: Check if payout already processed
    if (externalReference) {
      const existing = await this.db.query(
        `SELECT t.*
         FROM transactions t
         JOIN transaction_codes tc ON t.transaction_code_id = tc.id
         WHERE tc.code = 'PAYOUT' AND t.external_reference = $1 AND t.status = 'completed'
         LIMIT 1`,
        [externalReference],
      );
      if (existing.rows.length > 0) {
        return existing.rows[0]; // Return existing transaction
      }
    }

    const reference = `PAY-${uuidv4()}`;

    // Get accounts
    const chamaAccount = await this.getChamaAccount(chamaId);
    const userAccount = await this.getUserAccount(userId);

    // Validate
    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }

    // Check chama balance
    const chamaBalance = await this.getAccountBalance(chamaAccount.id);
    if (chamaBalance < amount) {
      throw new BadRequestException('Insufficient chama balance');
    }

    // Create entries
    const entries: TransactionEntry[] = [
      {
        accountId: chamaAccount.id,
        direction: EntryDirection.DEBIT,
        amount: amount,
        description: 'Payout made',
      },
      {
        accountId: userAccount.id,
        direction: EntryDirection.CREDIT,
        amount: amount,
        description: 'Payout received',
      },
    ];

    // Execute transaction
    return await this.executeTransaction(
      {
        transactionCode: 'PAYOUT',
        amount: amount,
        description: description,
        externalReference: externalReference,
        metadata: { chamaId, userId },
      },
      entries,
    );
  }

  // ==========================================
  // CORE DOUBLE-ENTRY LOGIC
  // ==========================================

  /**
   * Execute a transaction with double-entry bookkeeping
   */
  private async executeTransaction(
    transactionDto: CreateTransactionDto,
    entries: TransactionEntry[],
    feeAmount: number = 0,
  ): Promise<any> {
    return await this.db.transaction(async (client) => {
      // 1. Get transaction code
      const transactionCodeResult = await client.query(
        'SELECT * FROM transaction_codes WHERE code = $1',
        [transactionDto.transactionCode],
      );

      if (transactionCodeResult.rows.length === 0) {
        throw new BadRequestException('Invalid transaction code');
      }

      const transactionCode = transactionCodeResult.rows[0];

      // 2. Get ledger
      const ledgerResult = await client.query(
        'SELECT id FROM ledgers WHERE is_active = true LIMIT 1',
      );
      const ledgerId = ledgerResult.rows[0].id;

      // 3. Generate unique reference
      const reference = `${transactionDto.transactionCode}-${Date.now()}-${uuidv4().substring(0, 8)}`;

      // 4. Calculate totals
      const totalDebits = entries
        .filter((e) => e.direction === EntryDirection.DEBIT)
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCredits = entries
        .filter((e) => e.direction === EntryDirection.CREDIT)
        .reduce((sum, e) => sum + e.amount, 0);

      // 5. Validate double-entry balance
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new BadRequestException(
          `Double-entry validation failed: Debits (${totalDebits}) must equal Credits (${totalCredits})`,
        );
      }

      // 6. Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO transactions (
          ledger_id, transaction_code_id, reference, description, 
          amount, fee_amount, total_amount, status, external_reference, 
          initiated_by, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          ledgerId,
          transactionCode.id,
          reference,
          transactionDto.description,
          transactionDto.amount,
          feeAmount,
          transactionDto.amount,
          TransactionStatus.PROCESSING,
          transactionDto.externalReference,
          transactionDto.initiatedBy,
          JSON.stringify(transactionDto.metadata || {}),
        ],
      );

      const transaction = transactionResult.rows[0];

      // 7. Lock accounts (prevent concurrent modifications)
      for (const entry of entries) {
        await client.query(
          'INSERT INTO transaction_locks (account_id, transaction_id) VALUES ($1, $2)',
          [entry.accountId, transaction.id],
        );
      }

      // 8. Create entries and update balances
      const createdEntries: any[] = [];

      for (const entry of entries) {
        // Get account with normality
        const accountResult = await client.query(
          `SELECT a.*, at.normality 
           FROM accounts a
           JOIN account_types at ON a.account_type_id = at.id
           WHERE a.id = $1 FOR UPDATE`,
          [entry.accountId],
        );

        if (accountResult.rows.length === 0) {
          throw new BadRequestException(`Account ${entry.accountId} not found`);
        }

        const account = accountResult.rows[0];
        const balanceBefore = parseFloat(account.balance);
        let balanceAfter: number;

        // Calculate new balance based on account normality and entry direction
        // Round to 2 decimal places to avoid floating-point precision errors
        if (account.normality === AccountNormality.DEBIT) {
          // Debit normal accounts: Debits increase, Credits decrease
          if (entry.direction === EntryDirection.DEBIT) {
            balanceAfter =
              Math.round((balanceBefore + entry.amount) * 100) / 100;
          } else {
            balanceAfter =
              Math.round((balanceBefore - entry.amount) * 100) / 100;
          }
        } else {
          // Credit normal accounts: Credits increase, Debits decrease
          if (entry.direction === EntryDirection.CREDIT) {
            balanceAfter =
              Math.round((balanceBefore + entry.amount) * 100) / 100;
          } else {
            balanceAfter =
              Math.round((balanceBefore - entry.amount) * 100) / 100;
          }
        }

        // Prevent negative balances for liability accounts (user/chama wallets)
        if (balanceAfter < 0 && account.normality === AccountNormality.CREDIT) {
          throw new BadRequestException(
            `Insufficient balance in account ${account.name}`,
          );
        }

        // Create entry
        const entryResult = await client.query(
          `INSERT INTO entries (
            transaction_id, account_id, direction, amount, 
            balance_before, balance_after, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            transaction.id,
            entry.accountId,
            entry.direction,
            entry.amount,
            balanceBefore,
            balanceAfter,
            entry.description,
          ],
        );

        createdEntries.push(entryResult.rows[0]);
      }

      // 9. Update transaction status to completed
      await client.query(
        `UPDATE transactions 
         SET status = $1, completed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [TransactionStatus.COMPLETED, transaction.id],
      );

      // 10. Release locks
      await client.query(
        'UPDATE transaction_locks SET released_at = CURRENT_TIMESTAMP WHERE transaction_id = $1',
        [transaction.id],
      );

      // 11. Return transaction with entries
      return {
        ...transaction,
        entries: createdEntries,
        status: TransactionStatus.COMPLETED,
      };
    });
  }

  // ==========================================
  // REPORTING & AUDIT
  // ==========================================

  /**
   * Check ledger balance (ensure debits = credits)
   */
  async checkLedgerBalance(): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM v_ledger_balance_check
    `);

    return result.rows[0];
  }

  /**
   * Get account statement
   */
  async getAccountStatement(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    let query = `
      SELECT 
        e.*,
        t.reference,
        t.description AS transaction_description,
        t.created_at AS transaction_date
      FROM entries e
      JOIN transactions t ON e.transaction_id = t.id
      WHERE e.account_id = $1
    `;

    const params: any[] = [accountId];

    if (startDate) {
      params.push(startDate);
      query += ` AND t.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND t.created_at <= $${params.length}`;
    }

    query += ' ORDER BY e.created_at DESC';

    const result = await this.db.query(query, params);

    return result.rows;
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<any> {
    const transactionResult = await this.db.query(
      `SELECT t.*, tc.name AS transaction_type 
       FROM transactions t
       JOIN transaction_codes tc ON t.transaction_code_id = tc.id
       WHERE t.id = $1`,
      [transactionId],
    );

    if (transactionResult.rows.length === 0) {
      throw new BadRequestException('Transaction not found');
    }

    const entriesResult = await this.db.query(
      `SELECT e.*, a.account_number, a.name AS account_name
       FROM entries e
       JOIN accounts a ON e.account_id = a.id
       WHERE e.transaction_id = $1`,
      [transactionId],
    );

    return {
      ...transactionResult.rows[0],
      entries: entriesResult.rows,
    };
  }
}
