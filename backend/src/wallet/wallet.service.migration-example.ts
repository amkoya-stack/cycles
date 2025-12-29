/**
 * Migration Example: Wallet Service
 * 
 * This shows how to migrate wallet.service.ts to use the mapper utility.
 * This is a BEFORE/AFTER comparison.
 */

import { mapQueryResult, mapQueryRow } from '../database/mapper.util';

// ==========================================
// STEP 1: Define TypeScript Interfaces
// ==========================================

interface Transaction {
  id: string;
  reference: string;
  externalReference: string | null;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt: Date | null;
  transactionType: string; // 'DEPOSIT', 'WITHDRAWAL', etc.
  transactionName: string;
  amount: number;
  direction: 'debit' | 'credit';
  balanceBefore: number;
  balanceAfter: number;
}

interface TransactionDetails {
  id: string;
  reference: string;
  externalReference: string | null;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt: Date | null;
  transactionType: string;
  transactionName: string;
  entries: Array<{
    accountId: string;
    accountName: string;
    direction: 'debit' | 'credit';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
  }>;
}

// ==========================================
// BEFORE: Manual Row Access
// ==========================================

/*
async getTransactionHistory(
  userId: string,
  filters: TransactionFilter,
): Promise<any> {
  await this.db.setUserContext(userId);

  let query = `
    SELECT 
      t.id,
      t.reference,
      t.external_reference,
      CASE 
        WHEN t.description IS NULL THEN (
          SELECT tc.name 
          FROM transaction_codes tc 
          WHERE tc.id = t.transaction_code_id 
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

  // ... apply filters ...

  const result = await this.db.query(query, params);
  await this.db.clearContext();

  return {
    transactions: result.rows, // Raw database rows with snake_case
    count: result.rowCount,
  };
}
*/

// ==========================================
// AFTER: Using Mapper Utility
// ==========================================

async getTransactionHistory(
  userId: string,
  filters: TransactionFilter,
): Promise<{ transactions: Transaction[]; count: number }> {
  await this.db.setUserContext(userId);

  let query = `
    SELECT 
      t.id,
      t.reference,
      t.external_reference,
      CASE 
        WHEN t.description IS NULL THEN (
          SELECT tc.name 
          FROM transaction_codes tc 
          WHERE tc.id = t.transaction_code_id 
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
  await this.db.clearContext();

  // ✅ Use mapper to convert rows to TypeScript objects
  const transactions = mapQueryResult<Transaction>(result, {
    dateFields: ['createdAt', 'completedAt'],
    numberFields: ['amount', 'balanceBefore', 'balanceAfter'],
  });

  return {
    transactions, // Properly typed TypeScript objects with camelCase
    count: result.rowCount,
  };
}

// ==========================================
// BEFORE: getTransactionDetails
// ==========================================

/*
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
    JOIN transaction_codes tc ON t.transaction_code_id = tc.id
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

  return result.rows[0]; // Raw row with snake_case
}
*/

// ==========================================
// AFTER: Using Mapper with JSON Fields
// ==========================================

async getTransactionDetails(
  userId: string,
  transactionId: string,
): Promise<TransactionDetails> {
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
    JOIN transaction_codes tc ON t.transaction_code_id = tc.id
    JOIN entries e ON t.id = e.transaction_id
    JOIN accounts a ON e.account_id = a.id
    WHERE t.id = $1
    GROUP BY t.id, tc.code, tc.name`,
    [transactionId],
  );

  await this.db.clearContext();

  // ✅ Use mapper with JSON field parsing
  const transaction = mapQueryRow<TransactionDetails>(result, {
    dateFields: ['createdAt', 'completedAt'],
    jsonFields: ['entries'], // Parse JSONB/JSON array
  });

  if (!transaction) {
    throw new NotFoundException('Transaction not found');
  }

  return transaction; // Properly typed with camelCase and parsed JSON
}

// ==========================================
// BONUS: Migrating getBalance
// ==========================================

interface BalanceResult {
  balance: number;
  currency: string;
  lastUpdated: Date;
}

/*
// BEFORE:
async getBalance(userId: string): Promise<number> {
  const result = await this.db.query(
    'SELECT ABS(balance) as balance FROM accounts WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundException('Account not found');
  }
  
  return parseFloat(result.rows[0].balance);
}
*/

// AFTER:
async getBalance(userId: string): Promise<number> {
  const result = await this.db.query(
    'SELECT ABS(balance) as balance FROM accounts WHERE user_id = $1',
    [userId]
  );
  
  const account = mapQueryRow<BalanceResult>(result, {
    numberFields: ['balance'],
  });
  
  if (!account) {
    throw new NotFoundException('Account not found');
  }
  
  return account.balance; // Type-safe, already a number
}

// ==========================================
// BONUS: Migrating User Queries
// ==========================================

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  createdAt: Date;
}

/*
// BEFORE:
const userResult = await this.db.query(
  'SELECT email, phone FROM users WHERE id = $1',
  [userId]
);
const user = userResult.rows[0];
await this.notification.sendDepositReceipt(
  user.email,
  user.phone,
  // ...
);
*/

// AFTER:
const userResult = await this.db.query(
  'SELECT id, email, phone, full_name, created_at FROM users WHERE id = $1',
  [userId]
);

const user = mapQueryRow<UserRow>(userResult, {
  dateFields: ['createdAt'],
});

if (!user) {
  throw new NotFoundException('User not found');
}

// Now you have type-safe access:
await this.notification.sendDepositReceipt(
  user.email, // TypeScript knows this is string | null
  user.phone, // TypeScript knows this is string | null
  // ...
);

