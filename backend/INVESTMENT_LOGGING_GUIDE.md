# Investment Module Logging Guide

## Overview
The investment module now includes comprehensive structured logging to facilitate debugging and monitoring. All logs use consistent prefixes for easy filtering and searching.

## Log Prefixes

### Service Layer
- `[INVESTMENT_CREATE]` - Investment creation operations
- `[INVESTMENT_EXECUTE]` - Investment execution operations
- `[DIVIDEND_DISTRIBUTE]` - Dividend distribution operations
- `[DIVIDEND_DISTRIBUTE_INTERNAL]` - Internal dividend distribution (queue processor)
- `[PRODUCT_GET]` - Product retrieval operations
- `[IDEMPOTENCY]` - Idempotency checks and marks

### Queue Processor
- `[QUEUE_EXECUTE_INVESTMENT]` - Investment execution job processing
- `[QUEUE_DISTRIBUTE_DIVIDEND]` - Dividend distribution job processing

### API Controller
- `[API_CREATE_INVESTMENT]` - Create investment API requests
- `[API_EXECUTE_INVESTMENT]` - Execute investment API requests
- `[API_DISTRIBUTE_DIVIDEND]` - Distribute dividend API requests

## Log Levels

### `logger.log()` - INFO
Used for:
- Operation start/completion
- Successful operations
- Important state changes
- Idempotent request detection

### `logger.debug()` - DEBUG
Used for:
- Detailed step-by-step operations
- Data fetching operations
- Validation checks
- Internal state transitions

### `logger.warn()` - WARN
Used for:
- Validation failures
- Non-critical errors
- Missing optional data
- Idempotency check failures

### `logger.error()` - ERROR
Used for:
- Operation failures
- Exceptions with full stack traces
- Critical errors that prevent operation completion

## What Gets Logged

### Investment Creation
- Request details (chamaId, productId, amount, userId, idempotencyKey)
- Product validation (minimum/maximum amounts)
- Expected return calculation
- Governance proposal creation (if required)
- Idempotency checks
- Investment record creation
- Success/failure with full context

### Investment Execution
- Queue job details (jobId, investmentId, executedBy, idempotencyKey)
- Investment status validation
- Chama balance checks
- Fund transfer operations
- Status updates
- Job duration
- Retry attempts

### Dividend Distribution
- Distribution request details
- Investment status validation
- Share calculations (for pooled investments)
- Dividend record creation
- Wallet transfers
- Investment total updates
- Success/failure with full context

### Idempotency Operations
- Idempotency key checks (Redis and database)
- Cache hits/misses
- Idempotency marking operations

## Log Context Fields

All logs include relevant context:
- **User IDs**: `userId`, `createdBy`, `executedBy`, `distributedBy`
- **Investment IDs**: `investmentId`, `productId`, `chamaId`
- **Financial Data**: `amount`, `expectedReturn`, `balance`
- **Job Data**: `jobId`, `idempotencyKey`, `externalReference`
- **Network Data**: `ipAddress`
- **Timing**: `duration` (for queue operations)
- **Status**: `status`, `attempt` (for retries)

## Example Log Entries

### Successful Investment Creation
```
[INVESTMENT_CREATE] Starting investment creation - chamaId: abc-123, productId: xyz-456, amount: 100000, createdBy: user-789, idempotencyKey: key-123
[INVESTMENT_CREATE] Product fetched - name: 91-Day T-Bill, type: treasury_bill_91
[INVESTMENT_CREATE] Amount validation passed - amount: 100000
[INVESTMENT_CREATE] Expected return calculated - expectedReturn: 5000
[INVESTMENT_CREATE] Governance proposal created - proposalId: prop-123
[INVESTMENT_CREATE] Investment created successfully - investmentId: inv-456, status: pending_approval, expectedReturn: 5000
```

### Failed Investment Execution
```
[QUEUE_EXECUTE_INVESTMENT] Processing investment execution job - jobId: job-123, investmentId: inv-456, executedBy: user-789, idempotencyKey: key-123, attempt: 1
[QUEUE_EXECUTE_INVESTMENT] Investment fetched - investmentId: inv-456, status: pending_approval, chamaId: abc-123, amount: 100000
[QUEUE_EXECUTE_INVESTMENT] Invalid investment status - jobId: job-123, investmentId: inv-456, status: pending_approval, expected: approved
[QUEUE_EXECUTE_INVESTMENT] Investment execution failed - jobId: job-123, investmentId: inv-456, error: Investment is not approved. Current status: pending_approval
```

### Idempotent Request
```
[INVESTMENT_CREATE] Checking idempotency - idempotencyKey: key-123
[IDEMPOTENCY] Found existing investment - idempotencyKey: key-123, investmentId: inv-456
[INVESTMENT_CREATE] Idempotent request - returning existing investment - idempotencyKey: key-123, investmentId: inv-456
```

## Searching Logs

### Find all investment operations
```bash
grep "\[INVESTMENT_" logs/app.log
```

### Find all errors
```bash
grep "ERROR" logs/app.log | grep "\[INVESTMENT\|\[QUEUE\|\[API_"
```

### Find operations for specific investment
```bash
grep "investmentId: inv-456" logs/app.log
```

### Find operations by user
```bash
grep "userId: user-789" logs/app.log
```

### Find failed operations
```bash
grep "failed\|Failed\|ERROR" logs/app.log | grep "\[INVESTMENT\|\[QUEUE\|\[API_"
```

### Find idempotency issues
```bash
grep "\[IDEMPOTENCY" logs/app.log
```

## Monitoring Recommendations

1. **Error Rate**: Monitor `ERROR` level logs
2. **Operation Duration**: Monitor `duration` fields in queue logs
3. **Idempotency Hits**: Monitor idempotent request logs
4. **Validation Failures**: Monitor `WARN` level logs
5. **Queue Retries**: Monitor `attempt` fields in queue logs

## Debugging Workflow

1. **Identify the operation**: Look for the operation prefix (`[INVESTMENT_CREATE]`, etc.)
2. **Find the request**: Search for the initial log entry with request details
3. **Trace the flow**: Follow the debug logs to see each step
4. **Find the error**: Look for ERROR or WARN level logs
5. **Check context**: Review all context fields (IDs, amounts, statuses)

## Best Practices

1. **Always include context**: All logs include relevant IDs and data
2. **Log at appropriate levels**: Use DEBUG for details, INFO for milestones, ERROR for failures
3. **Include timing**: Queue operations include duration
4. **Log before and after**: Log both request start and completion
5. **Include stack traces**: All ERROR logs include full stack traces

