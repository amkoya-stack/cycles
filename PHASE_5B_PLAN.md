# Phase 5B: Rotation and Payout System

## Overview

Implement the chama rotation system where members take turns receiving the pooled contributions according to a defined rotation order.

## Database Schema (Migration 013)

### Tables to Create:

1. **rotation_orders**

   - Manages the sequence in which members receive payouts
   - Fields: id, chama_id, rotation_type, cycle_duration, status, start_date, created_at, updated_at
   - Rotation types: 'sequential', 'random', 'merit_based', 'custom'

2. **rotation_positions**

   - Tracks each member's position in the rotation
   - Fields: id, rotation_order_id, member_id, position, cycle_assigned, status, assigned_at, completed_at
   - Status: 'pending', 'current', 'completed', 'skipped'

3. **payouts**

   - Records payout transactions
   - Fields: id, chama_id, cycle_id, recipient_id, amount, status, payout_method, scheduled_at, executed_at, external_reference, metadata (JSONB)
   - Status: 'pending', 'processing', 'completed', 'failed', 'cancelled'

4. **payout_distributions**
   - Tracks individual contributions that make up a payout
   - Fields: id, payout_id, contribution_id, amount, created_at
   - Links contributions to the payout they fund

## Backend Services

### 1. RotationService (`rotation.service.ts`)

**Responsibilities:**

- Create and manage rotation orders
- Assign members to rotation positions
- Determine next recipient based on rotation type
- Handle rotation rule logic (sequential, random, merit-based)
- Skip/swap rotation positions

**Key Methods:**

```typescript
createRotationOrder(chamaId, type, options);
assignMemberPositions(rotationOrderId, members);
getNextRecipient(rotationOrderId);
skipPosition(positionId, reason);
swapPositions(position1Id, position2Id, requiresVote);
calculateMeritScore(memberId); // For merit-based rotations
getRotationStatus(chamaId);
```

### 2. PayoutService (`payout.service.ts`)

**Responsibilities:**

- Process payout transactions
- Distribute pooled contributions to recipient
- Handle payout scheduling
- Track payout status
- Integrate with ledger for double-entry accounting

**Key Methods:**

```typescript
schedulePayout(cycleId, recipientId, amount);
executePayout(payoutId);
calculatePayoutAmount(cycleId); // Total contributions - fees
distributeContributions(payoutId, contributions);
cancelPayout(payoutId, reason);
retryFailedPayout(payoutId);
getPayoutHistory(chamaId, filters);
```

### 3. PayoutProcessorService (`payout.processor.ts`)

**Responsibilities:**

- Automated payout execution (cron jobs)
- Process pending payouts
- Retry failed payouts
- Send payout notifications

**Key Methods:**

```typescript
@Cron('0 1 * * *') // Daily at 1 AM
processPendingPayouts()

@Cron('0 3 * * *') // Daily at 3 AM
retryFailedPayouts()

processPayoutBatch(payouts)
notifyPayoutSuccess(payout)
notifyPayoutFailure(payout, error)
```

## API Endpoints

### Rotation Management

```
POST   /api/chama/:chamaId/rotation/create       - Create rotation order
GET    /api/chama/:chamaId/rotation              - Get rotation details
PUT    /api/chama/:chamaId/rotation/:id          - Update rotation order
POST   /api/chama/:chamaId/rotation/skip         - Skip a position
POST   /api/chama/:chamaId/rotation/swap         - Swap two positions
GET    /api/chama/:chamaId/rotation/next         - Get next recipient
GET    /api/chama/:chamaId/rotation/positions    - List all positions
```

### Payout Management

```
POST   /api/chama/payouts/schedule               - Schedule payout
POST   /api/chama/payouts/:id/execute            - Execute payout
POST   /api/chama/payouts/:id/cancel             - Cancel payout
POST   /api/chama/payouts/:id/retry              - Retry failed payout
GET    /api/chama/payouts/history                - Payout history
GET    /api/chama/payouts/:id                    - Get payout details
GET    /api/chama/:chamaId/payouts/upcoming      - Upcoming payouts
```

## Business Logic

### Rotation Types

1. **Sequential** (Default)

   - Members receive payouts in a fixed order
   - Order determined at chama creation
   - Each member gets exactly one turn per full rotation

2. **Random**

   - Random selection from eligible members
   - Each member guaranteed one turn before any get a second
   - Transparent randomization (blockchain/provable)

3. **Merit-Based**

   - Members with better contribution history get priority
   - Score factors:
     - On-time contribution rate
     - Activity score
     - Penalty-free history
     - Participation level
   - Recalculated each cycle

4. **Custom**
   - Admin-defined order
   - Can be modified with member voting
   - Supports manual adjustments

### Payout Calculation

```typescript
// Total payout = contributions - platform fees
const totalContributions = cycle.collectedAmount;
const platformFee = totalContributions * 0.045; // 4.5% on contributions
const payoutAmount = totalContributions - platformFee;
```

**Important:** Platform fees are collected during contributions, not payouts. Payout is the net amount after fees.

### Payout Execution Flow

1. **Schedule**: When cycle ends, system identifies next recipient
2. **Validate**: Check rotation position, member eligibility
3. **Calculate**: Determine payout amount from cycle contributions
4. **Execute**:
   - Create ledger transaction (PAYOUT transaction code)
   - DR: Chama Wallet
   - CR: User Wallet (recipient)
5. **Notify**: Send success notification to recipient
6. **Update**: Mark rotation position as completed

### Ledger Integration

New transaction code: `PAYOUT`

```typescript
// Example: $1000 payout from chama to member
entries = [
  { accountId: chamaWalletId, amount: -1000, type: "debit" },
  { accountId: userWalletId, amount: 1000, type: "credit" },
];
```

## Frontend Components (Phase 5B)

### 1. Rotation Dashboard (`rotation-dashboard.tsx`)

- Display current rotation order
- Show next recipient
- Timeline/progress visualization
- Member position cards with status

### 2. Rotation Management (`rotation-management.tsx`)

- Create/edit rotation orders
- Rotation type selector
- Member position assignment
- Drag-and-drop reordering (custom mode)

### 3. Payout History (`payout-history.tsx`)

- List all payouts with filters
- Payout details (amount, recipient, date)
- Status tracking
- Export functionality

### 4. Upcoming Payouts (`upcoming-payouts.tsx`)

- Scheduled payouts calendar
- Next recipient preview
- Countdown to payout date

## Testing Requirements

### Unit Tests

- Rotation logic (sequential, random, merit-based)
- Payout calculation
- Position assignment
- Skip/swap functionality

### Integration Tests

- Full payout flow (schedule → execute → notify)
- Rotation completion cycle
- Ledger transaction integrity
- Failed payout retry logic

### E2E Tests

- Member receives payout
- Rotation advances to next member
- Merit score calculation
- Position swapping with voting

## Migration Order

1. **013_rotation_and_payout_system.sql**
   - Create rotation_orders table
   - Create rotation_positions table
   - Create payouts table
   - Create payout_distributions table
   - Add indexes for performance
   - Add foreign key constraints

## Success Criteria

✅ Rotation orders can be created for all types
✅ Members can be assigned positions
✅ Next recipient is correctly determined
✅ Payouts execute successfully via ledger
✅ Rotation advances after payout
✅ Failed payouts can be retried
✅ Merit scores calculate correctly
✅ Position swapping works with optional voting
✅ All payout transactions are auditable
✅ Frontend displays rotation status clearly

## Timeline

- Database Migration: 30 min
- Rotation Service: 2 hours
- Payout Service: 2 hours
- Payout Processor: 1 hour
- API Endpoints: 1 hour
- Frontend Components: 2 hours
- Testing: 1 hour

**Total Estimate**: 9-10 hours

## Next Steps After Phase 5B

Once Phase 5B is complete, we'll have:

1. Full contribution system with reminders and auto-debits
2. Complete rotation and payout system
3. All Phase 5 functionality ready for comprehensive testing

Then we can proceed with:

- **Phase 5 E2E Testing**: Full integration testing of contributions + payouts
- **Phase 6**: Reporting, analytics, and compliance features
