# Row Level Security (RLS) Context Guide

## Overview

This application uses PostgreSQL Row Level Security (RLS) to ensure data isolation and security. **RLS context must be set before querying RLS-protected tables**, otherwise queries will silently return 0 rows.

## Problem: Silent RLS Blocking

When RLS is enabled on a table, queries that don't have the proper context set will return **0 rows** without throwing an error. This can lead to:

- Empty results when data exists
- Silent failures in production
- Difficult-to-debug issues

## Solution: Always Set Context

### 1. For Public/Admin Operations (System Context)

Use `queryAsSystem()` or manually set system context:

```typescript
// Option 1: Use helper method (RECOMMENDED)
const result = await this.db.queryAsSystem(
  'SELECT * FROM chamas WHERE status = $1',
  ['active']
);

// Option 2: Manual context management
await this.db.setSystemContext();
try {
  const result = await this.db.query('SELECT * FROM chamas');
  return result.rows;
} finally {
  await this.db.clearContext();
}
```

### 2. For User-Specific Operations (User Context)

Use `queryAsUser()` or manually set user context:

```typescript
// Option 1: Use helper method (RECOMMENDED)
const result = await this.db.queryAsUser(
  userId,
  'SELECT * FROM chamas c JOIN chama_members cm ON c.id = cm.chama_id WHERE cm.user_id = $1',
  [userId]
);

// Option 2: Manual context management
await this.db.setUserContext(userId);
try {
  const result = await this.db.query('SELECT * FROM chamas');
  return result.rows;
} finally {
  await this.db.clearContext();
}
```

### 3. For Transactions

Use transaction helpers that automatically handle context:

```typescript
// System transaction
await this.db.transactionAsSystem(async (client) => {
  // All queries here have system context
  await client.query('INSERT INTO chamas ...');
});

// User transaction
await this.db.transactionWithUser(userId, async (client) => {
  // All queries here have user context
  await client.query('SELECT * FROM chamas ...');
});
```

## RLS-Protected Tables

The following tables have RLS enabled:

- `chamas`
- `chama_members`
- `chama_invites`
- `contributions`
- `contribution_cycles`
- `payouts`
- `transactions`
- `entries`
- `accounts`
- `proposals`
- `votes`
- `proposal_discussions`

**Always set context before querying these tables.**

## Development Safeguards

### Automatic Validation (Development Only)

In development/staging, the `RlsValidatorService` automatically:

1. **Warns** when querying RLS-protected tables without context
2. **Detects** when queries return 0 rows due to missing context
3. **Logs** warnings to help catch issues early

### Example Warning

```
⚠️  Querying RLS-protected table without context set: SELECT * FROM chamas...
🚨 POTENTIAL RLS BLOCKING: Query returned 0 rows and RLS context is not set!
```

## Best Practices

### ✅ DO

1. **Always use helper methods** (`queryAsSystem`, `queryAsUser`) for RLS-protected queries
2. **Set context at the start** of methods that query RLS-protected tables
3. **Clear context in finally blocks** to prevent context leakage
4. **Use transaction helpers** (`transactionAsSystem`, `transactionWithUser`) for multi-query operations
5. **Test with RLS enabled** to catch issues early

### ❌ DON'T

1. **Don't query RLS-protected tables** without setting context first
2. **Don't forget to clear context** after setting it
3. **Don't assume 0 rows means no data** - check if context is set
4. **Don't disable RLS validation** in production (it's already disabled for performance)

## Migration Checklist

When adding new queries to RLS-protected tables:

- [ ] Identify if the query needs system or user context
- [ ] Use `queryAsSystem()` or `queryAsUser()` helper methods
- [ ] Or manually set context before querying
- [ ] Clear context in finally block if manually set
- [ ] Test with RLS enabled
- [ ] Verify results are not empty when data exists

## Common Patterns

### Pattern 1: Public List Endpoint

```typescript
async listPublicChamas(): Promise<any> {
  // Use system context for public access
  const result = await this.db.queryAsSystem(
    'SELECT * FROM chamas WHERE status = $1',
    ['active']
  );
  return result.rows;
}
```

### Pattern 2: User-Specific List

```typescript
async listUserChamas(userId: string): Promise<any> {
  // Use user context for user-specific data
  const result = await this.db.queryAsUser(
    userId,
    `SELECT c.* FROM chamas c
     JOIN chama_members cm ON c.id = cm.chama_id
     WHERE cm.user_id = $1`,
    [userId]
  );
  return result.rows;
}
```

### Pattern 3: Complex Transaction

```typescript
async createChama(userId: string, dto: CreateChamaDto): Promise<any> {
  // Use system transaction for admin operations
  return await this.db.transactionAsSystem(async (client) => {
    const chama = await client.query(
      'INSERT INTO chamas ... RETURNING *'
    );
    await client.query(
      'INSERT INTO chama_members ...'
    );
    return chama.rows[0];
  });
}
```

## Troubleshooting

### Issue: Query returns 0 rows but data exists

**Check:**
1. Is context set? Use `RlsValidatorService.validateContext()`
2. Is the table RLS-protected? Check the list above
3. Are you using the correct context (system vs user)?

**Solution:**
```typescript
// Before query
await this.db.setSystemContext(); // or setUserContext(userId)

// Your query
const result = await this.db.query('SELECT * FROM chamas');

// After query
await this.db.clearContext();
```

### Issue: Context not persisting across queries

**Check:**
1. Are you using connection pooling? Context is per-connection
2. Are you clearing context too early?

**Solution:**
Use transaction helpers or set context once per method:

```typescript
async myMethod() {
  await this.db.setSystemContext();
  try {
    const result1 = await this.db.query('SELECT ...');
    const result2 = await this.db.query('SELECT ...');
    return { result1, result2 };
  } finally {
    await this.db.clearContext();
  }
}
```

## Production Considerations

1. **RLS validation is disabled in production** for performance
2. **Always test with RLS enabled** in development/staging
3. **Monitor for empty results** that might indicate RLS blocking
4. **Use helper methods** to ensure context is always set
5. **Document context requirements** in code comments

## Related Files

- `backend/src/database/database.service.ts` - Database service with context helpers
- `backend/src/database/rls-validator.service.ts` - RLS validation service
- `backend/src/database/rls-context.guard.ts` - Guard for automatic context setting
- `backend/src/migrations/006_security_and_audit.sql` - RLS setup
- `backend/src/migrations/008_chama_system.sql` - Chama RLS policies

