/**
 * Mapper Utility Examples
 * 
 * This file shows how to use the mapper utilities in your services.
 */

import { mapRow, mapRows, toRow, buildUpdateSet, extractValues, mapQueryResult, mapQueryRow } from './mapper.util';

// ==========================================
// Example 1: Basic Row Mapping
// ==========================================

interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

// Database row (snake_case)
const dbRow = {
  id: '123',
  email: 'user@example.com',
  full_name: 'John Doe',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

// Map to TypeScript object
const user = mapRow<User>(dbRow, {
  dateFields: ['createdAt', 'updatedAt'],
});

// Result: { id: '123', email: 'user@example.com', fullName: 'John Doe', createdAt: Date, updatedAt: Date }

// ==========================================
// Example 2: Query Result Mapping
// ==========================================

async function getUsers(db: any) {
  const result = await db.query('SELECT * FROM users');
  
  // Map all rows
  const users = mapRows<User>(result.rows, {
    dateFields: ['createdAt', 'updatedAt'],
  });
  
  return users;
}

// Or use the helper
async function getUsersHelper(db: any) {
  const result = await db.query('SELECT * FROM users');
  return mapQueryResult<User>(result, {
    dateFields: ['createdAt', 'updatedAt'],
  });
}

// ==========================================
// Example 3: Single Row with Type Conversions
// ==========================================

interface Transaction {
  id: string;
  amount: number;
  feeAmount: number;
  isCompleted: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
}

async function getTransaction(db: any, id: string) {
  const result = await db.query('SELECT * FROM transactions WHERE id = $1', [id]);
  
  return mapQueryRow<Transaction>(result, {
    dateFields: ['createdAt'],
    numberFields: ['amount', 'feeAmount'],
    booleanFields: ['isCompleted'],
    jsonFields: ['metadata'],
  });
}

// ==========================================
// Example 4: Converting to Database Format
// ==========================================

async function createUser(db: any, userData: Partial<User>) {
  // Convert camelCase to snake_case for database
  const row = toRow(userData, {
    excludeFields: ['id'], // Don't include id in INSERT
  });
  
  const fields = Object.keys(row);
  const values = Object.values(row);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `
    INSERT INTO users (${fields.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await db.query(query, values);
  return mapRow<User>(result.rows[0], {
    dateFields: ['createdAt', 'updatedAt'],
  });
}

// ==========================================
// Example 5: UPDATE with buildUpdateSet
// ==========================================

async function updateUser(db: any, id: string, updates: Partial<User>) {
  const { setClause, values } = buildUpdateSet(updates, {
    excludeFields: ['id', 'createdAt'], // Don't update these
  });
  
  if (!setClause) {
    throw new Error('No fields to update');
  }
  
  const query = `
    UPDATE users
    SET ${setClause}, updated_at = NOW()
    WHERE id = $${values.length + 1}
    RETURNING *
  `;
  
  const result = await db.query(query, [...values, id]);
  return mapRow<User>(result.rows[0], {
    dateFields: ['createdAt', 'updatedAt'],
  });
}

// ==========================================
// Example 6: Complex Type with Nested Objects
// ==========================================

interface Chama {
  id: string;
  name: string;
  settings: {
    rotationMode: string;
    autoPayout: boolean;
  };
  createdAt: Date;
}

async function getChama(db: any, id: string) {
  const result = await db.query('SELECT * FROM chamas WHERE id = $1', [id]);
  
  return mapQueryRow<Chama>(result, {
    dateFields: ['createdAt'],
    jsonFields: ['settings'], // Parse JSONB column
  });
}

// ==========================================
// Example 7: Custom Transformations
// ==========================================

async function getUserWithCustomTransform(db: any, id: string) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  
  return mapQueryRow<User>(result, {
    dateFields: ['createdAt', 'updatedAt'],
    transforms: {
      email: (value) => value?.toLowerCase(), // Normalize email
      fullName: (value) => value?.trim(), // Trim whitespace
    },
  });
}

// ==========================================
// Example 8: Replacing Manual Mappers
// ==========================================

// BEFORE (manual mapping):
/*
private mapReputationScore(row: any): ReputationScore {
  return {
    id: row.id,
    userId: row.user_id,
    chamaId: row.chama_id,
    totalScore: row.total_score,
    // ... many more fields
    lastCalculatedAt: row.last_calculated_at,
  };
}
*/

// AFTER (using mapper):
/*
const score = mapRow<ReputationScore>(row, {
  dateFields: ['lastCalculatedAt'],
  numberFields: ['totalScore', 'contributionScore', 'loanRepaymentScore'],
});
*/

