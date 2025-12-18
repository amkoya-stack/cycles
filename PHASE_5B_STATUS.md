# Phase 5B Implementation Status

## ✅ Completed

### 1. Planning & Documentation

- [x] Created PHASE_5B_PLAN.md with comprehensive requirements
- [x] Defined rotation types (sequential, random, merit_based, custom)
- [x] Defined payout calculation and execution flow
- [x] Documented ledger integration for payouts

### 2. Database Schema (Migration 013)

- [x] Created `rotation_orders` table
- [x] Created `rotation_positions` table
- [x] Enhanced `payouts` table with rotation_position_id
- [x] Created `payout_distributions` table
- [x] Added all necessary indexes
- [x] Created triggers for auto-updates
- [x] Created views (`v_active_rotations`, `v_payout_summary`)
- [x] Migration successfully applied

### 3. DTOs

- [x] Created `rotation.dto.ts` (CreateRotationOrder, Skip, Swap)
- [x] Created `payout.dto.ts` (Schedule, Execute, Cancel, Retry, GetHistory)

## 🚧 In Progress / Remaining Work

### Backend Services (Estimated: 5-6 hours)

#### 1. RotationService (`rotation.service.ts`) - 2 hours

**Priority: High**

Services to implement:

```typescript
- createRotationOrder(dto) - Create rotation with type and options
- assignMemberPositions(rotationOrderId, members) - Assign sequential positions
- getNextRecipient(rotationOrderId) - Determine next recipient by type
- skipPosition(positionId, reason) - Skip a member's turn
- swapPositions(position1Id, position2Id) - Swap two positions
- calculateMeritScore(memberId) - For merit-based rotations
- getRotationStatus(chamaId) - Get current rotation details
- advanceRotation(rotationOrderId) - Move to next position
```

Key logic:

- Sequential: Simple position += 1
- Random: Cryptographically random from remaining eligible members
- Merit-based: Score = (on-time rate _ 40) + (activity score _ 30) + (penalty-free \* 30)
- Custom: Use manually defined order with voting for changes

#### 2. PayoutService (`payout.service.ts`) - 2 hours

**Priority: High**

Services to implement:

```typescript
- schedulePayout(dto) - Create pending payout record
- executePayout(payoutId) - Process payout via ledger
- calculatePayoutAmount(cycleId) - Sum contributions for cycle
- distributeContributions(payoutId) - Link contributions to payout
- cancelPayout(payoutId, reason) - Mark payout as cancelled
- retryFailedPayout(payoutId) - Retry with exponential backoff
- getPayoutHistory(filters) - Query payouts with pagination
- getPayoutDetails(payoutId) - Full payout info with distributions
```

Ledger integration:

```typescript
// Create PAYOUT transaction
const entries = [
  { accountId: chamaWalletId, amount: -payoutAmount, type: "debit" },
  { accountId: userWalletId, amount: payoutAmount, type: "credit" },
];
await ledgerService.executeTransaction({
  transactionCode: "PAYOUT",
  externalReference,
  entries,
});
```

#### 3. PayoutProcessorService (`payout.processor.ts`) - 1 hour

**Priority: Medium**

Cron jobs:

```typescript
@Cron('0 1 * * *') // Daily at 1 AM
async processPendingPayouts() {
  // Find payouts where scheduled_at <= NOW and status = 'pending'
  // Execute each payout via payoutService
  // Send notifications
}

@Cron('0 3 * * *') // Daily at 3 AM
async retryFailedPayouts() {
  // Find failed payouts with retry_count < 3
  // Retry with 6-hour minimum gap
  // Update retry_count
}
```

#### 4. API Controllers - 1 hour

**Priority: High**

**RotationController** (`rotation.controller.ts`):

```
POST   /api/chama/:chamaId/rotation/create
GET    /api/chama/:chamaId/rotation
PUT    /api/chama/:chamaId/rotation/:id
POST   /api/chama/:chamaId/rotation/skip
POST   /api/chama/:chamaId/rotation/swap
GET    /api/chama/:chamaId/rotation/next
GET    /api/chama/:chamaId/rotation/positions
```

**PayoutController** (`payout.controller.ts`):

```
POST   /api/chama/payouts/schedule
POST   /api/chama/payouts/:id/execute
POST   /api/chama/payouts/:id/cancel
POST   /api/chama/payouts/:id/retry
GET    /api/chama/payouts/history
GET    /api/chama/payouts/:id
GET    /api/chama/:chamaId/payouts/upcoming
```

### Frontend Components (Estimated: 2-3 hours)

#### 1. Rotation Dashboard (`rotation-dashboard.tsx`)

- Display current rotation order with visual timeline
- Show next recipient with countdown
- Member cards with position and status
- Progress indicator (X of Y completed)

#### 2. Rotation Management (`rotation-management.tsx`)

- Create rotation form (type selector, start date)
- View/edit rotation settings
- Skip position dialog
- Swap positions interface with drag-and-drop

#### 3. Payout History (`payout-history.tsx`)

- Table/list of all payouts
- Filters (status, date range, recipient)
- Payout details modal
- Export to CSV

#### 4. Upcoming Payouts (`upcoming-payouts.tsx`)

- Calendar view of scheduled payouts
- Next payout card with recipient info
- Schedule new payout button (admin only)

### Testing (Estimated: 1-2 hours)

- [ ] Unit tests for rotation logic
- [ ] Unit tests for payout calculation
- [ ] Integration tests for payout execution
- [ ] E2E test: Full rotation cycle
- [ ] E2E test: Payout processing
- [ ] Test merit score calculation
- [ ] Test skip/swap functionality

## Next Immediate Steps

1. **Create RotationService** - Core logic for managing rotation orders
2. **Create PayoutService** - Handle payout execution via ledger
3. **Create PayoutProcessorService** - Automated cron jobs
4. **Create API Controllers** - Expose rotation and payout endpoints
5. **Build Frontend Components** - UI for rotation and payout management
6. **Integration Testing** - Test full Phase 5 (contributions + payouts)

## Estimated Time Remaining

- Backend: 5-6 hours
- Frontend: 2-3 hours
- Testing: 1-2 hours

**Total: 8-11 hours**

## Current Files Created

1. `PHASE_5B_PLAN.md` - Comprehensive plan
2. `backend/src/migrations/013_rotation_and_payout_system.sql` - Database schema
3. `backend/src/chama/dto/rotation.dto.ts` - Rotation DTOs
4. `backend/src/chama/dto/payout.dto.ts` - Payout DTOs

## Dependencies

- ✅ Ledger system (Phase 1-2)
- ✅ Chama system (Phase 4)
- ✅ Contribution system (Phase 5A)
- ✅ Database migration framework

All dependencies are in place. Ready to implement services.
