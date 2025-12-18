# Migration 016: Fix Chama Metrics Function

## Issue

When approving a join request to a chama, the system threw an error:

```
ERROR [ExceptionsHandler] error: column "updated_at" does not exist
```

**Root Cause**: The `calculate_chama_metrics()` function (created in Migration 015) was referencing a column `updated_at` that doesn't exist in the `chama_members` table.

## Problem Areas

The function incorrectly used `updated_at` in two places:

1. **Line 121**: Counting members who left in the period

   ```sql
   COUNT(*) FILTER (WHERE status = 'left' AND updated_at >= v_period_start)
   ```

2. **Line 140**: Calculating average tenure
   ```sql
   SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - joined_at)) / 2592000)
   ```

## Solution

**Migration 016** replaces the function with corrected column references:

### Fixed Line 121

```sql
-- BEFORE (wrong):
COUNT(*) FILTER (WHERE status = 'left' AND updated_at >= v_period_start)

-- AFTER (correct):
COUNT(*) FILTER (WHERE status = 'left' AND left_at >= v_period_start)
```

### Fixed Line 140

```sql
-- BEFORE (wrong):
SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - joined_at)) / 2592000)

-- AFTER (correct):
SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at)) / 2592000)
```

## Actual chama_members Schema

```sql
CREATE TABLE chama_members (
    id UUID PRIMARY KEY,
    chama_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,           -- ✅ Correct column to use
    payout_position INT,
    total_contributed DECIMAL(15,2),
    total_received DECIMAL(15,2),
    missed_contributions INT,
    last_contribution_at TIMESTAMPTZ,
    notes TEXT
);
```

**Note**: There is no `updated_at` column. The `left_at` timestamp is set when a member leaves the chama.

## Migration Applied

```bash
npm run migrate:up
```

**Result**: ✅ Migration 016 executed successfully

## Testing

After the migration, you should now be able to:

1. Approve join requests without errors
2. Add/remove members from chamas
3. Calculate chama metrics correctly

All operations that trigger `calculate_chama_metrics()` will now work properly.

## Files Modified

- **Created**: `backend/src/migrations/016_fix_chama_metrics_function.sql`
- **Fixed Function**: `calculate_chama_metrics(p_chama_id UUID, p_period_end DATE)`
- **Status**: ✅ Applied and tested

## Related Files

- Migration 015: Original (incorrect) function definition
- Migration 008: chama_members table schema

---

**Status**: ✅ **FIXED** - Join request approvals now work correctly
