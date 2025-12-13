# Cycle Platform - AI Agent Instructions

## Project Overview

Cycle is a fintech platform for digital chamas (savings groups) built with:

- **Backend**: NestJS + TypeScript (NodeNext), PostgreSQL, Redis
- **Frontend**: Next.js 15 + TypeScript, shadcn/ui components
- **Infrastructure**: Docker Compose (PostgreSQL, Redis, MongoDB, PgAdmin)

## Frontend Development (Next.js)

### Component Architecture

- **Heavily component-based** - Break down UI into small, reusable components (avoid monolithic files)
- Max ~200 lines per component - extract sub-components if larger
- Co-locate related components in feature folders

```typescript
// Good: Small, focused components
components/
├── auth/
│   ├── LoginForm.tsx       // ~80 lines
│   ├── OtpInput.tsx        // ~50 lines
│   └── RegisterForm.tsx    // ~120 lines
├── wallet/
│   ├── BalanceCard.tsx
│   ├── TransactionList.tsx
│   └── DepositButton.tsx

// Bad: Monolithic files
❌ components/AuthPage.tsx  // 800 lines
```

### Design System

**Color Palette (STRICT - use these only):**

```css
--primary: #083232;       /* Dark teal - primary actions, headers */
--primary-light: #2e856e; /* Medium teal - hover states, accents */
--secondary: #f64d52;     /* Coral red - alerts, CTAs, highlights */

/* Usage examples */
<Button className="bg-[#083232] hover:bg-[#2e856e]">Login</Button>
<Alert className="border-[#f64d52] text-[#f64d52]">Error message</Alert>
```

**UI/UX Principles:**

- Clean, minimal interfaces - avoid visual clutter
- Clear hierarchy with whitespace
- Consistent spacing (use Tailwind: p-4, gap-2, etc.)
- Accessible color contrast (WCAG AA minimum)

### Mobile-First Responsive Design

**This app is primarily accessed via mobile phones:**

```typescript
// Always start with mobile layout, then scale up
<div className="
  flex flex-col gap-4          /* Mobile: stack vertically */
  md:flex-row md:gap-6         /* Tablet: horizontal layout */
  lg:grid lg:grid-cols-3       /* Desktop: grid layout */
">
```

**Critical patterns:**

- Touch targets: min 44x44px (use `min-h-11 min-w-11`)
- Bottom navigation for primary actions (easier thumb reach)
- Large, tappable buttons (not tiny links)
- Scrollable content areas (avoid fixed heights on mobile)
- Test at 375px width (iPhone SE baseline)

```typescript
// Good: Mobile-optimized transaction card
<Card className="p-4 active:scale-95 transition-transform">
  <div className="flex items-center justify-between min-h-16">
    <div className="flex-1">
      <p className="text-base font-medium">Deposit</p>  {/* Readable on mobile */}
      <p className="text-sm text-gray-600">Dec 13, 2025</p>
    </div>
    <p className="text-lg font-bold text-[#083232]">KES 1,000</p>
  </div>
</Card>

// Bad: Desktop-first, tiny text
❌ <div className="grid grid-cols-4 text-xs">...</div>
```

### shadcn/ui Integration

- Use existing shadcn components from `components/ui/`
- Customize with color palette overrides in `globals.css`
- Extend components, don't fork them

### Frontend File Organization

```
frontend/
├── app/              # Next.js 15 App Router
│   ├── (auth)/      # Auth routes (login, register)
│   ├── dashboard/   # Dashboard pages
│   └── api/         # API routes (if needed)
├── components/
│   ├── ui/          # shadcn base components
│   ├── auth/        # Auth-specific components
│   ├── wallet/      # Wallet features
│   └── chama/       # Chama/group features
└── lib/
    ├── utils.ts     # Utility functions
    └── api.ts       # Backend API client
```

## Architecture Principles

### Double-Entry Ledger System

The core is a PostgreSQL-based ledger with deferred constraint validation:

- All money movements are **double-entry transactions** (debit + credit = 0)
- Accounts have normality (debit/credit) that determines balance sign
- **Critical**: Use `ledger.service.ts` for ALL financial operations - never raw SQL
- Transactions are atomic via `db.transaction()` - balance validation happens at commit

**Account Type Hierarchy** (see `001_create_ledger_system.sql`):

```
System Accounts (is_system=true):
├── CASH              → Platform cash (asset/debit)   - Money in partner banks
├── USER_WALLET       → User balances (liability/credit) - Money owed to users
├── CHAMA_WALLET      → Chama balances (liability/credit) - Money owed to groups
├── REVENUE_FEES      → Fee income (revenue/credit)   - Transaction fees earned
├── EQUITY            → Founders equity (equity/credit) - Platform capital
├── EXPENSE_*         → Operating costs (expense/debit) - Taxes, salaries, etc.
└── PENDING_*         → Temporary holds (asset/liability) - Awaiting confirmation

User/Chama Accounts (is_system=false):
├── One account per user (links via user_id)
└── One account per chama (links via chama_id)
```

**Transaction Codes** (define business logic):

```typescript
// Core Operations
DEPOSIT      → External → Platform Cash + User Wallet (no fee)
WITHDRAWAL   → User Wallet → External via Platform Cash (no fee)
TRANSFER     → User Wallet → User Wallet (no fee)

// Chama Operations
CONTRIBUTION → User Wallet → Chama Wallet + 4.5% fee to REVENUE_FEES
PAYOUT       → Chama Wallet → User Wallet (no fee)

// Example: $100 chama contribution journals as:
// DR: User Wallet -$104.50
// CR: Chama Wallet +$100.00
// CR: Revenue +$4.50
```

**Critical Pattern - Money Movement**:

```typescript
// ALWAYS use ledger service methods:
await ledgerService.processDeposit({ userId, amount, externalReference });
await ledgerService.processTransfer({ senderId, receiverId, amount });

// NEVER manipulate accounts directly:
❌ await db.query('UPDATE accounts SET balance = balance + $1', [amount]);
✅ await ledgerService.executeTransaction({ entries: [...] });
```

### Custom Security Implementation (No External Libs)

- **Password/OTP hashing**: Scrypt-based via `crypto.util.ts` (not bcrypt/argon2)
- **JWT**: Custom HS256 signing in `jwt.util.ts` (not @nestjs/jwt)
- **Rate limiting**: Redis-backed middleware on OTP endpoints (5 req/60s)
- Access tokens: 15min, Refresh tokens: 30 days (stored in DB, revoked on password reset)

### Authentication Flow (Phase 1 Complete)

1. Register → generates hashed OTPs for phone/email verification
2. Login → verifies password, checks 2FA flag, issues tokens
3. OTP verification → marks phone/email verified, issues tokens
4. Protected routes use `@UseGuards(JwtAuthGuard)` - extracts `req.user.id`

```typescript
// Example: Protected endpoint pattern
@Post('kyc/basic')
@UseGuards(JwtAuthGuard)
async basicKyc(@Req() req: any, @Body() dto: BasicKycDto) {
  return this.authService.basicKycWithUser(req.user.id, dto);
}
```

## Development Workflows

### Database Management

```bash
# Start infrastructure
docker compose up -d

# Run migrations (sequential SQL files in src/migrations/)
npm run migrate:up

# Check migration status
npm run migrate:status

# Seed system accounts (required for ledger operations)
npm run seed:system-accounts

# Reset database (drops all tables)
npm run db:reset
```

**Migration Pattern**: Numbered SQL files (001*, 002*, etc.) with idempotent CREATE TABLE IF NOT EXISTS. Migrations tracked in `schema_migrations` table.

### Testing

```bash
# E2E tests (requires Docker services running)
npm run test:e2e

# Tests auto-set NODE_ENV=development, ALLOW_DEV_OTP_RETURN=true
# OTP codes are returned in responses for testing
```

**Test Pattern**: Each test suite creates a new app instance, sets `/api` global prefix. Auth tests verify full flow: register → OTP → verify → tokens.

### API Testing

Postman collection in `postman/cycle-ledger.postman_collection.json`:

- Pre-request scripts auto-generate `externalReference` UUIDs
- Test scripts capture `userId`, `accessToken`, `otpCode` into collection variables
- Base URL: `http://localhost:3001/api` (or `{{baseUrl}}` variable)

## Code Conventions

### Module Organization

```
src/
├── auth/          # JWT, OTP, KYC, 2FA endpoints
├── ledger/        # Core accounting engine (use ONLY this for money)
├── users/         # User CRUD + KYC persistence
├── wallet/        # User wallet (links user → ledger account)
├── chama/         # Group functionality
├── database/      # Connection pool, transaction helpers
├── cache/         # Redis service (get/set/incr/expire)
└── migrations/    # Sequential SQL files
```

### Database Transactions

Always wrap multi-step operations in transactions:

```typescript
await this.db.transaction(async (client) => {
  // All queries use `client` not `this.db`
  await client.query("INSERT INTO ...");
  await client.query("UPDATE ...");
  // Commit happens automatically if no errors
});
```

### TypeScript Configuration

- Module: `NodeNext` (use `.js` extensions in relative imports? NO - removed for Jest compatibility)
- Strict mode enabled, class-validator for DTOs
- ESM imports: Use `import type` for type-only, regular `import` for runtime values

### Error Handling

- Use NestJS exceptions: `BadRequestException`, `UnauthorizedException`, `ConflictException`
- Ledger service throws `BadRequestException` for insufficient balance, invalid accounts
- Rate limiter throws `BadRequestException` with "Too many requests" message

## Key Files Reference

### Ledger Operations

- `src/ledger/ledger.service.ts` (857 lines) - ALL money movement logic
- `src/ledger/ledger.example.ts` - Usage examples (deposit, withdrawal, transfer)
- `src/migrations/001_create_ledger_system.sql` - Schema with deferred constraints

### Authentication

- `src/auth/auth.service.ts` - Register, login, OTP, 2FA, password reset
- `src/auth/crypto.util.ts` - Scrypt hashing (hashPassword, verifyPassword, hashOtp, verifyOtp)
- `src/auth/jwt.util.ts` - Custom JWT sign/verify with HS256
- `src/auth/rate-limit.middleware.ts` - Redis-backed rate limiter

### Security & Audit (Migration 006)

- `src/migrations/006_security_and_audit.sql` - Audit log, RLS policies, reconciliation tables
- `src/ledger/reconciliation.service.ts` - Daily/hourly balance validation
- `src/ledger/reconciliation.processor.ts` - Bull queue job handlers
- `src/ledger/reconciliation.controller.ts` - API endpoints for reconciliation
- `src/database/database.service.ts` - Pool management, transaction wrapper, RLS context helpers

### Database

- `src/database/database.service.ts` - Pool management, transaction wrapper, RLS context helpers
  - `setUserContext(userId)` - Enable RLS filtering for user
  - `setSystemContext()` - Bypass RLS for ledger operations
  - `transactionWithUser()` - Run transaction with user context
  - `transactionAsSystem()` - Run transaction as system (bypasses RLS)
- `src/scripts/run-migrations.ts` - Migration runner (tracks in `schema_migrations`)

## Current Status

### Phase 1 Complete ✅

✅ User registration with email/phone
✅ Login with password verification + optional 2FA
✅ OTP verification (hashed storage, dev echo mode)
✅ Basic KYC, Next-of-Kin, Profile endpoints
✅ JWT auth with refresh token rotation
✅ 2FA enable/disable/verify
✅ Password reset with OTP
✅ Redis-backed rate limiting
✅ E2E tests passing (4/4)

### Production Security Complete ✅ (Migration 006)

✅ **Immutable audit logging** - All ledger operations logged to `audit_log` table
✅ **Row-level security (RLS)** - Users can only see their own transactions/accounts
✅ **Automated reconciliation** - Daily/hourly jobs validate ledger integrity
✅ **Compliance-ready** - SOC 2 / ISO 27001 audit trail

⚠️ **Pending**: Africa's Talking SMS integration (OTP currently stored only, not sent)

## Ledger Invariants (Must Hold)

**Balance Sheet Rules**:

1. Total debits ALWAYS equal total credits across all accounts
2. Asset + Expense accounts have positive debit balance
3. Liability + Equity + Revenue accounts have positive credit balance
4. Every transaction must have at least one debit and one credit entry

**Idempotency**:

````typescript
// All transactions check externalReference before processing
const existing = await db.query(
  'SELECT id FROM transactions WHERE external_reference = $1 AND status = "completed"',
  [externalReference]
);
if (existing.rowCount > 0) return existing.rows[0]; // Already processed
```Audit Logging & RLS (Migration 006)

**Automatic Audit Logging**:
- All transactions/entries/accounts changes are auto-logged to `audit_log` table
- Captures: operation, user_id, IP, old_data (JSONB), new_data (JSONB)
- Append-only - triggers prevent UPDATE/DELETE on audit_log
- Never write to audit_log manually - triggers handle it

**Row-Level Security (RLS)**:
```typescript
// For user-facing queries, set user context
await db.setUserContext(req.user.id);
const result = await db.query('SELECT * FROM transactions'); // Only sees own transactions

// For system operations (ledger service), bypass RLS
await db.setSystemContext();
const result = await db.query('SELECT * FROM transactions'); // Sees all transactions
````

**RLS Policies**:

- transactions: Users see only transactions they initiated or involve their accounts
- entries: Users see only entries for their accounts
- accounts: Users see only their own accounts (or chama accounts they're members of)
- System context bypasses all RLS (for ledger service operations)

**Reconciliation Jobs**:

```typescript
// Manual reconciliation
POST /api/reconciliation/run

// Schedule daily job (2 AM)
POST /api/reconciliation/schedule/daily

// View history
GET /api/reconciliation/history?limit=30

// Get run details
GET /api/reconciliation/:runId
```

**Reconciliation Checks**:

1. Ledger balance (total debits = total credits)
2. Negative balances on liability accounts (shouldn't happen)
3. Unbalanced transactions (debits ≠ credits within transaction)
4. Results stored in `reconciliation_runs` and `reconciliation_items` tables

## Common Pitfalls

1. **Don't bypass ledger service** - Use `processDeposit()`, `processTransfer()`, etc. Never UPDATE accounts directly
2. **Don't forget transactions** - Multi-step DB operations must use `db.transaction(async client => {...})`
3. **Idempotency is critical** - Always pass `externalReference` for deposits/withdrawals (prevents double-processing)
4. **Balance normality** - User wallets are CREDIT accounts (opposite of bank account UX)
5. **Fee handling** - Fees are separate CR entries to REVENUE_FEES, not subtracted from amount
6. **OTP codes are hashed** - Use `verifyOtp()` from crypto.util, not direct comparison
7. **Rate limiting keys** - Include path|destination|IP for proper isolation
8. **JWT expiry** - Access tokens are 15min - use refresh tokens for long sessions
9. **Global prefix** - Backend routes are `/api/*` not `/*` (set in main.ts)
10. **RLS context** - Always set system context for ledger operations, user context for user queries
11. **Audit logs are automatic** - Don't manually write to audit_log, triggers handle it

## Common Pitfalls

1. **Don't bypass ledger service** - Use `processDeposit()`, `processTransfer()`, etc. Never UPDATE accounts directly
2. **Don't forget transactions** - Multi-step DB operations must use `db.transaction(async client => {...})`
3. **Idempotency is critical** - Always pass `externalReference` for deposits/withdrawals (prevents double-processing)
4. **Balance normality** - User wallets are CREDIT accounts (opposite of bank account UX)
5. **Fee handling** - Fees are separate CR entries to REVENUE_FEES, not subtracted from amount
6. **OTP codes are hashed** - Use `verifyOtp()` from crypto.util, not direct comparison
7. **Rate limiting keys** - Include path|destination|IP for proper isolation
8. **JWT expiry** - Access tokens are 15min - use refresh tokens for long sessions
9. **Global prefix** - Backend routes are `/api/*` not `/*` (set in main.ts)
