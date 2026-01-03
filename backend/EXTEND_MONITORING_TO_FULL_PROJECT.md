# Extending Monitoring to Full Project

## Current Status

**Currently Covered:**
- ✅ Phase 13 (Investment Module) - Full coverage
- ✅ Generic metrics (rate limiting, idempotency, queues)
- ✅ System metrics (CPU, memory)

**Not Yet Covered:**
- ❌ Wallet Module
- ❌ Lending Module
- ❌ Ledger Module
- ❌ Chama Module
- ❌ Other modules (governance, chat, meetings, etc.)

## How to Extend

### Step 1: Add Metrics to Each Module

For each module, add metrics recording in key operations:

#### Wallet Module Example

```typescript
// In wallet.service.ts
import { MetricsService } from '../common/services/metrics.service';

constructor(
  private readonly metrics: MetricsService,
  // ... other services
) {}

async processTransaction(data: TransactionDto) {
  const startTime = Date.now();
  
  try {
    const result = await this.executeTransaction(data);
    
    // Record success
    this.metrics.recordWalletTransaction('deposit', 'success', Date.now() - startTime);
    return result;
  } catch (error) {
    // Record error
    this.metrics.recordWalletTransaction('deposit', 'error', Date.now() - startTime);
    this.metrics.recordWalletError(error.constructor.name, 'deposit');
    throw error;
  }
}
```

#### Lending Module Example

```typescript
// In lending.service.ts
async processLoan(loanId: string) {
  const startTime = Date.now();
  
  try {
    const loan = await this.executeLoan(loanId);
    this.metrics.recordLendingOperation('process_loan', 'success', Date.now() - startTime);
    return loan;
  } catch (error) {
    this.metrics.recordLendingOperation('process_loan', 'error', Date.now() - startTime);
    this.metrics.recordLendingError(error.constructor.name, 'process_loan');
    throw error;
  }
}
```

### Step 2: Extend Metrics Service

Add new metrics to `backend/src/common/services/metrics.service.ts`:

```typescript
// Wallet Metrics
public readonly walletTransactionTotal: Counter<string>;
public readonly walletTransactionDuration: Histogram<string>;
public readonly walletTransactionErrors: Counter<string>;
public readonly mpesaReconciliationFailures: Counter<string>;

// Lending Metrics
public readonly lendingOperationsTotal: Counter<string>;
public readonly lendingOperationDuration: Histogram<string>;
public readonly lendingErrorsTotal: Counter<string>;
public readonly loansByStatus: Gauge<string>;

// Ledger Metrics
public readonly ledgerReconciliationStatus: Gauge<string>;
public readonly ledgerUnbalancedTransactions: Gauge<string>;

// Chama Metrics
public readonly chamaContributionErrors: Counter<string>;
public readonly chamaPayoutFailures: Counter<string>;
```

### Step 3: Add Alert Rules

Use the provided `prometheus-alerts-full-project.yml` or add rules to existing file:

```bash
# Merge into prometheus.yml
rule_files:
  - 'prometheus-alerts.yml'
  - 'prometheus-alerts-full-project.yml'
```

### Step 4: Create Additional Dashboards

Create Grafana dashboards for each module:
- `grafana-dashboard-wallet.json`
- `grafana-dashboard-lending.json`
- `grafana-dashboard-ledger.json`
- `grafana-dashboard-chama.json`
- `grafana-dashboard-system.json`

### Step 5: Update Alert Manager Routes

Add module-specific routes in `alertmanager-config.yml`:

```yaml
routes:
  - match:
      module: wallet
    receiver: 'wallet-team'
  - match:
      module: lending
    receiver: 'lending-team'
  # ... etc
```

## Priority Order

1. **Wallet Module** (Critical - handles all financial transactions)
2. **Ledger Module** (Critical - double-entry accounting integrity)
3. **Lending Module** (Important - loan processing)
4. **Chama Module** (Important - contributions and payouts)
5. **Other Modules** (Nice to have)

## Quick Implementation

To quickly extend to wallet module:

1. Add wallet metrics to `MetricsService`
2. Record metrics in `WalletService` operations
3. Add wallet alerts to `prometheus-alerts.yml`
4. Create wallet dashboard
5. Test and verify

## Benefits

- **Early Detection**: Catch issues before they impact users
- **Performance Monitoring**: Identify bottlenecks
- **Financial Integrity**: Monitor critical financial operations
- **Compliance**: Track all financial transactions
- **Operational Excellence**: Proactive issue resolution

---

**Would you like me to implement monitoring for a specific module?** Start with Wallet or Ledger for maximum impact.

