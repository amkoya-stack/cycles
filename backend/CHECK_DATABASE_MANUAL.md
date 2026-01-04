# Manual Database Check Guide

## Quick Connection

### Using psql (Command Line)

```bash
# Connect to database
psql -h localhost -p 5432 -U postgres -d cycle

# Or if you have password in environment
psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE
```

### Using Connection String

```bash
psql postgresql://postgres:your_password@localhost:5432/cycle
```

---

## Useful Queries to Check Database State

### 1. Check Current Time and Database Info

```sql
SELECT
  NOW() as current_time,
  CURRENT_DATE as current_date,
  current_database() as database_name,
  current_user as database_user;
```

### 2. Check All Tables

```sql
-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Count tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public';
```

### 3. Check Chamas

```sql
-- Count chamas
SELECT COUNT(*) as total_chamas FROM chamas;

-- List all chamas with details
SELECT
  id,
  name,
  status,
  created_at,
  admin_user_id
FROM chamas
ORDER BY created_at DESC;

-- Check chama members
SELECT COUNT(*) as total_members FROM chama_members;

SELECT
  cm.id,
  cm.chama_id,
  cm.user_id,
  cm.role,
  cm.status,
  c.name as chama_name,
  cm.joined_at
FROM chama_members cm
LEFT JOIN chamas c ON cm.chama_id = c.id
ORDER BY cm.joined_at DESC
LIMIT 20;
```

### 4. Check Users

```sql
-- Count users
SELECT COUNT(*) as total_users FROM users;

-- List recent users
SELECT
  id,
  email,
  phone,
  full_name,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;
```

### 5. Check Ledger/Accounts

```sql
-- Count accounts
SELECT COUNT(*) as total_accounts FROM accounts;

-- List accounts with balances
SELECT
  a.id,
  a.account_number,
  a.name,
  at.code as account_type_code,
  at.category as account_category,
  a.balance,
  a.user_id,
  a.chama_id,
  a.created_at
FROM accounts a
LEFT JOIN account_types at ON a.account_type_id = at.id
ORDER BY a.created_at DESC
LIMIT 20;

-- Check account totals by type
SELECT
  at.category,
  COUNT(*) as count,
  SUM(a.balance) as total_balance
FROM accounts a
LEFT JOIN account_types at ON a.account_type_id = at.id
GROUP BY at.category;

-- Check chama wallets
SELECT
  a.account_number,
  a.name,
  a.balance,
  a.chama_id,
  c.name as chama_name
FROM accounts a
LEFT JOIN chamas c ON a.chama_id = c.id
WHERE a.chama_id IS NOT NULL;

-- Check user wallets
SELECT
  a.account_number,
  a.name,
  a.balance,
  a.user_id,
  u.email
FROM accounts a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.user_id IS NOT NULL;
```

### 6. Check Transactions

```sql
-- Count transactions
SELECT COUNT(*) as total_transactions FROM transactions;

-- List recent transactions
SELECT
  id,
  code,
  description,
  amount,
  status,
  created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 20;

-- Transaction summary
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM transactions
GROUP BY status;
```

### 7. Check Ledger Entries

```sql
-- Count entries
SELECT COUNT(*) as total_entries FROM entries;

-- Check double-entry balance
SELECT
  SUM(amount) FILTER (WHERE type = 'debit') as total_debits,
  SUM(amount) FILTER (WHERE type = 'credit') as total_credits,
  SUM(amount) FILTER (WHERE type = 'debit') -
  SUM(amount) FILTER (WHERE type = 'credit') as difference
FROM entries;

-- Should be 0 if balanced
```

### 8. Check Migration History

```sql
-- List all executed migrations
SELECT
  id,
  name,
  filename,
  executed_at
FROM migrations
ORDER BY executed_at DESC;

-- Check migration status
SELECT
  COUNT(*) as total_executed,
  MIN(executed_at) as first_migration,
  MAX(executed_at) as last_migration
FROM migrations;
```

### 9. Check Database Size

```sql
-- Database size
SELECT
  pg_size_pretty(pg_database_size(current_database())) as database_size;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### 10. Quick Health Check Query

```sql
-- Comprehensive health check
SELECT
  'Users' as entity, COUNT(*)::text as count FROM users
UNION ALL
SELECT 'Chamas', COUNT(*)::text FROM chamas
UNION ALL
SELECT 'Chama Members', COUNT(*)::text FROM chama_members
UNION ALL
SELECT 'Accounts', COUNT(*)::text FROM accounts
UNION ALL
SELECT 'Transactions', COUNT(*)::text FROM transactions
UNION ALL
SELECT 'Entries', COUNT(*)::text FROM entries
UNION ALL
SELECT 'Migrations', COUNT(*)::text FROM migrations;
```

---

## Using GUI Tools

### pgAdmin

1. Download and install [pgAdmin](https://www.pgadmin.org/download/)
2. Add new server:
   - Host: `localhost`
   - Port: `5432`
   - Database: `cycle`
   - Username: `postgres`
   - Password: (your password)
3. Browse tables, run queries, view data

### DBeaver

1. Download [DBeaver](https://dbeaver.io/download/)
2. Create new PostgreSQL connection
3. Enter connection details
4. Browse and query database

### VS Code Extension

1. Install "PostgreSQL" extension in VS Code
2. Add connection in extension settings
3. Run queries directly in VS Code

---

## Quick Commands Reference

```bash
# Connect to database
psql -h localhost -U postgres -d cycle

# Once connected, useful psql commands:
\l          # List all databases
\dt         # List all tables in current database
\d table_name  # Describe table structure
\du         # List users
\q          # Quit

# Run SQL file
psql -h localhost -U postgres -d cycle -f script.sql

# Export data
psql -h localhost -U postgres -d cycle -c "SELECT * FROM chamas;" -o output.csv

# Check if table exists
psql -h localhost -U postgres -d cycle -c "\d chamas"
```

---

## Environment Variables

If you're using environment variables, check your `.env` file:

```bash
# In backend directory
cat .env | grep DB_

# Should show:
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=your_password
# DB_DATABASE=cycle
```

---

## Troubleshooting

### Can't connect?

```bash
# Check if PostgreSQL is running
# Windows:
Get-Service postgresql*

# Linux/Mac:
sudo systemctl status postgresql
# or
brew services list | grep postgresql
```

### Permission denied?

```bash
# Check pg_hba.conf settings
# Usually in: /etc/postgresql/[version]/main/pg_hba.conf
# Or: C:\Program Files\PostgreSQL\[version]\data\pg_hba.conf
```

### Wrong database?

```bash
# List all databases
psql -h localhost -U postgres -l

# Connect to specific database
psql -h localhost -U postgres -d your_database_name
```
