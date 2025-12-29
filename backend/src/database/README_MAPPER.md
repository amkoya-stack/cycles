# Database Mapper Utility

Lightweight helpers for mapping between database rows (snake_case) and TypeScript objects (camelCase) without requiring an ORM.

## Why?

Since we're not using an ORM, we need to manually convert between:
- **Database format**: `snake_case` column names (e.g., `created_at`, `user_id`)
- **TypeScript format**: `camelCase` property names (e.g., `createdAt`, `userId`)

This utility automates that conversion and handles common type transformations.

## Quick Start

```typescript
import { mapRow, mapRows, mapQueryResult, mapQueryRow } from './database/mapper.util';

// Map a single row
const user = mapRow<User>(result.rows[0], {
  dateFields: ['createdAt', 'updatedAt'],
});

// Map multiple rows
const users = mapRows<User>(result.rows, {
  dateFields: ['createdAt', 'updatedAt'],
});

// Or use query result helpers
const users = mapQueryResult<User>(result, {
  dateFields: ['createdAt', 'updatedAt'],
});

const user = mapQueryRow<User>(result, {
  dateFields: ['createdAt', 'updatedAt'],
});
```

## Features

### 1. Automatic Key Conversion
- `snake_case` → `camelCase` (database → TypeScript)
- `camelCase` → `snake_case` (TypeScript → database)

### 2. Type Conversions
- **Dates**: Convert strings to Date objects
- **Numbers**: Parse strings to numbers
- **Booleans**: Convert to boolean
- **JSON**: Parse JSON strings/JSONB columns

### 3. Custom Transforms
- Apply custom functions to specific fields
- Normalize, trim, format values

### 4. Database Operations
- `toRow()`: Convert object to database format
- `buildUpdateSet()`: Build UPDATE SET clause
- `extractValues()`: Extract values for INSERT

## Examples

### Basic Usage

```typescript
interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt: Date;
}

// Database returns: { id, email, full_name, created_at }
const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);

// Map to TypeScript object
const user = mapQueryRow<User>(result, {
  dateFields: ['createdAt'],
});
// Result: { id, email, fullName, createdAt: Date }
```

### With Type Conversions

```typescript
interface Transaction {
  id: string;
  amount: number;
  isCompleted: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
}

const transaction = mapQueryRow<Transaction>(result, {
  dateFields: ['createdAt'],
  numberFields: ['amount'],
  booleanFields: ['isCompleted'],
  jsonFields: ['metadata'], // For JSONB columns
});
```

### Converting to Database Format

```typescript
// For INSERT
const userData = {
  email: 'user@example.com',
  fullName: 'John Doe',
};

const row = toRow(userData);
// Result: { email: 'user@example.com', full_name: 'John Doe' }

const fields = Object.keys(row);
const values = Object.values(row);
await db.query(
  `INSERT INTO users (${fields.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})`,
  values
);
```

### UPDATE Operations

```typescript
const updates = {
  email: 'new@example.com',
  fullName: 'Jane Doe',
};

const { setClause, values } = buildUpdateSet(updates, {
  excludeFields: ['id', 'createdAt'],
});

await db.query(
  `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`,
  [...values, userId]
);
```

## Migration Guide

### Before (Manual Mapping)

```typescript
private mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

const user = this.mapUser(result.rows[0]);
```

### After (Using Mapper)

```typescript
import { mapQueryRow } from '../database/mapper.util';

const user = mapQueryRow<User>(result, {
  dateFields: ['createdAt', 'updatedAt'],
});
```

## Benefits

1. **Less Boilerplate**: No need to write manual mapper functions
2. **Type Safety**: TypeScript types are preserved
3. **Consistent**: Same conversion logic everywhere
4. **Flexible**: Easy to add custom transformations
5. **Lightweight**: No ORM overhead, just utilities

## API Reference

### `mapRow<T>(row, options?)`
Map a single database row to TypeScript object.

### `mapRows<T>(rows, options?)`
Map an array of database rows.

### `mapQueryResult<T>(result, options?)`
Map `result.rows` from a query.

### `mapQueryRow<T>(result, options?)`
Map `result.rows[0]` or return null.

### `toRow<T>(obj, options?)`
Convert TypeScript object to database format.

### `buildUpdateSet(obj, options?)`
Build UPDATE SET clause with parameterized values.

### `extractValues(obj, fieldNames)`
Extract values in specific order for INSERT.

## Options

```typescript
interface MapOptions {
  dateFields?: string[];      // Convert to Date
  numberFields?: string[];     // Convert to number
  booleanFields?: string[];    // Convert to boolean
  jsonFields?: string[];       // Parse JSON
  transforms?: Record<string, (value: any) => any>; // Custom transforms
  skipKeyConversion?: boolean; // Use keys as-is
}
```

## See Also

- `backend/src/database/mapper.examples.ts` - More examples
- Existing services using manual mappers (can be migrated)

