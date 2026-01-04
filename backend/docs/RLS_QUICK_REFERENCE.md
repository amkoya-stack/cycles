# RLS Context Quick Reference

## ⚡ Quick Fixes

### Querying RLS-Protected Tables

```typescript
// ❌ WRONG - Will return 0 rows
const result = await this.db.query('SELECT * FROM chamas');

// ✅ CORRECT - Use helper method
const result = await this.db.queryAsSystem('SELECT * FROM chamas');
```

### Multiple Queries in One Method

```typescript
// ✅ Option 1: Use helper for each query
const chamas = await this.db.queryAsSystem('SELECT * FROM chamas');
const members = await this.db.queryAsSystem('SELECT * FROM chama_members');

// ✅ Option 2: Set context once (better for multiple queries)
await this.db.setSystemContext();
try {
  const chamas = await this.db.query('SELECT * FROM chamas');
  const members = await this.db.query('SELECT * FROM chama_members');
  return { chamas: chamas.rows, members: members.rows };
} finally {
  await this.db.clearContext();
}

// ✅ Option 3: Use transaction (best for multiple related queries)
await this.db.transactionAsSystem(async (client) => {
  const chamas = await client.query('SELECT * FROM chamas');
  const members = await client.query('SELECT * FROM chama_members');
  return { chamas: chamas.rows, members: members.rows };
});
```

## 📋 RLS-Protected Tables

Always set context before querying:
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

## 🔧 Helper Methods

| Method | Use Case | Context |
|--------|----------|---------|
| `queryAsSystem()` | Public/admin operations | System (bypasses RLS) |
| `queryAsUser(userId)` | User-specific queries | User (RLS filtered) |
| `transactionAsSystem()` | Multiple system queries | System (single connection) |
| `transactionWithUser(userId)` | Multiple user queries | User (single connection) |

## 🚨 Common Mistakes

1. **Forgetting context** - Query returns 0 rows
2. **Not clearing context** - Context leaks to next query
3. **Wrong context type** - Using user context for public data
4. **Multiple queries without transaction** - Each query may use different connection

## ✅ Checklist

Before querying RLS-protected tables:
- [ ] Is the table RLS-protected? (check list above)
- [ ] Do I need system or user context?
- [ ] Am I using a helper method?
- [ ] If multiple queries, am I using a transaction?
- [ ] Is context cleared in finally block (if manual)?

## 📚 Full Documentation

See `RLS_CONTEXT_GUIDE.md` for complete guide.

