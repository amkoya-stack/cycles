/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus Metrics Service
 * Exports metrics for monitoring investment module and other operations
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly register: Registry;

  // Investment Operations Metrics
  public readonly investmentOperationsTotal: Counter<string>;
  public readonly investmentOperationDuration: Histogram<string>;
  public readonly investmentErrorsTotal: Counter<string>;

  // Queue Metrics
  public readonly queueJobsTotal: Gauge<string>;
  public readonly queueJobDuration: Histogram<string>;
  public readonly queueJobFailures: Counter<string>;

  // Rate Limiting Metrics
  public readonly rateLimitHitsTotal: Counter<string>;
  public readonly rateLimitRequestsTotal: Counter<string>;

  // Idempotency Metrics
  public readonly idempotencyHitsTotal: Counter<string>;
  public readonly idempotencyMissesTotal: Counter<string>;

  // Investment Status Metrics
  public readonly investmentsByStatus: Gauge<string>;
  public readonly investmentAmounts: Histogram<string>;

  // Wallet Metrics
  public readonly walletTransactionTotal: Counter<string>;
  public readonly walletTransactionDuration: Histogram<string>;
  public readonly walletTransactionErrors: Counter<string>;
  public readonly walletTransactionAmounts: Histogram<string>;
  public readonly walletBalanceChecks: Counter<string>;
  public readonly mpesaReconciliationFailures: Counter<string>;
  public readonly mpesaReconciliationSuccess: Counter<string>;
  public readonly walletQueueJobsTotal: Gauge<string>;

  // Ledger Metrics
  public readonly ledgerTransactionTotal: Counter<string>;
  public readonly ledgerTransactionDuration: Histogram<string>;
  public readonly ledgerErrorsTotal: Counter<string>;
  public readonly ledgerReconciliationStatus: Gauge<string>;
  public readonly ledgerUnbalancedTransactions: Gauge<string>;

  // Lending Metrics
  public readonly lendingOperationsTotal: Counter<string>;
  public readonly lendingOperationDuration: Histogram<string>;
  public readonly lendingErrorsTotal: Counter<string>;
  public readonly loansByStatus: Gauge<string>;

  // Chama Metrics
  public readonly chamaContributionErrors: Counter<string>;
  public readonly chamaPayoutFailures: Counter<string>;
  public readonly chamaOperationsTotal: Counter<string>;

  // System Metrics
  public readonly httpRequestsTotal: Counter<string>;
  public readonly databaseConnectionStatus: Gauge<string>;
  public readonly redisConnectionStatus: Gauge<string>;

  constructor() {
    // Create a new registry
    this.register = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.register });

    // Investment Operations Counter
    this.investmentOperationsTotal = new Counter({
      name: 'investment_operations_total',
      help: 'Total number of investment operations',
      labelNames: ['operation', 'status'],
      registers: [this.register],
    });

    // Investment Operation Duration Histogram
    this.investmentOperationDuration = new Histogram({
      name: 'investment_operation_duration_seconds',
      help: 'Duration of investment operations in seconds',
      labelNames: ['operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Investment Errors Counter
    this.investmentErrorsTotal = new Counter({
      name: 'investment_errors_total',
      help: 'Total number of investment errors',
      labelNames: ['error_type', 'operation'],
      registers: [this.register],
    });

    // Queue Jobs Gauge
    this.queueJobsTotal = new Gauge({
      name: 'queue_jobs_total',
      help: 'Current number of queue jobs',
      labelNames: ['status', 'queue'],
      registers: [this.register],
    });

    // Queue Job Duration Histogram
    this.queueJobDuration = new Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue', 'job_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [this.register],
    });

    // Queue Job Failures Counter
    this.queueJobFailures = new Counter({
      name: 'queue_job_failures_total',
      help: 'Total number of failed queue jobs',
      labelNames: ['queue', 'job_type'],
      registers: [this.register],
    });

    // Rate Limiting Metrics
    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint', 'user_id'],
      registers: [this.register],
    });

    this.rateLimitRequestsTotal = new Counter({
      name: 'rate_limit_requests_total',
      help: 'Total number of requests (including rate limited)',
      labelNames: ['endpoint', 'status'],
      registers: [this.register],
    });

    // Idempotency Metrics
    this.idempotencyHitsTotal = new Counter({
      name: 'idempotency_hits_total',
      help: 'Total number of idempotency cache hits',
      labelNames: ['endpoint'],
      registers: [this.register],
    });

    this.idempotencyMissesTotal = new Counter({
      name: 'idempotency_misses_total',
      help: 'Total number of idempotency cache misses',
      labelNames: ['endpoint'],
      registers: [this.register],
    });

    // Investment Status Gauge
    this.investmentsByStatus = new Gauge({
      name: 'investments_by_status',
      help: 'Number of investments by status',
      labelNames: ['status'],
      registers: [this.register],
    });

    // Investment Amounts Histogram
    this.investmentAmounts = new Histogram({
      name: 'investment_amounts',
      help: 'Distribution of investment amounts',
      labelNames: ['product_type'],
      buckets: [1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.register],
    });

    // Wallet Transaction Counter
    this.walletTransactionTotal = new Counter({
      name: 'wallet_transaction_total',
      help: 'Total number of wallet transactions',
      labelNames: ['transaction_type', 'status'],
      registers: [this.register],
    });

    // Wallet Transaction Duration Histogram
    this.walletTransactionDuration = new Histogram({
      name: 'wallet_transaction_duration_seconds',
      help: 'Duration of wallet transactions in seconds',
      labelNames: ['transaction_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Wallet Transaction Errors Counter
    this.walletTransactionErrors = new Counter({
      name: 'wallet_transaction_errors_total',
      help: 'Total number of wallet transaction errors',
      labelNames: ['error_type', 'transaction_type'],
      registers: [this.register],
    });

    // Wallet Transaction Amounts Histogram
    this.walletTransactionAmounts = new Histogram({
      name: 'wallet_transaction_amounts',
      help: 'Distribution of wallet transaction amounts',
      labelNames: ['transaction_type'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
      registers: [this.register],
    });

    // Wallet Balance Checks Counter
    this.walletBalanceChecks = new Counter({
      name: 'wallet_balance_checks_total',
      help: 'Total number of wallet balance checks',
      registers: [this.register],
    });

    // M-Pesa Reconciliation Metrics
    this.mpesaReconciliationFailures = new Counter({
      name: 'mpesa_reconciliation_failures_total',
      help: 'Total number of M-Pesa reconciliation failures',
      labelNames: ['reconciliation_type'],
      registers: [this.register],
    });

    this.mpesaReconciliationSuccess = new Counter({
      name: 'mpesa_reconciliation_success_total',
      help: 'Total number of successful M-Pesa reconciliations',
      labelNames: ['reconciliation_type'],
      registers: [this.register],
    });

  // Wallet Queue Jobs Gauge
  this.walletQueueJobsTotal = new Gauge({
    name: 'wallet_queue_jobs_total',
    help: 'Current number of wallet queue jobs',
    labelNames: ['status', 'job_type'],
    registers: [this.register],
  });

    // Ledger Metrics
    this.ledgerTransactionTotal = new Counter({
      name: 'ledger_transaction_total',
      help: 'Total number of ledger transactions',
      labelNames: ['transaction_type', 'status'],
      registers: [this.register],
    });

    this.ledgerTransactionDuration = new Histogram({
      name: 'ledger_transaction_duration_seconds',
      help: 'Duration of ledger transactions in seconds',
      labelNames: ['transaction_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.ledgerErrorsTotal = new Counter({
      name: 'ledger_errors_total',
      help: 'Total number of ledger errors',
      labelNames: ['error_type', 'transaction_type'],
      registers: [this.register],
    });

    this.ledgerReconciliationStatus = new Gauge({
      name: 'ledger_reconciliation_status',
      help: 'Ledger reconciliation status (1=success, 0=failed)',
      labelNames: ['reconciliation_type'],
      registers: [this.register],
    });

    this.ledgerUnbalancedTransactions = new Gauge({
      name: 'ledger_unbalanced_transactions_total',
      help: 'Number of unbalanced transactions detected',
      registers: [this.register],
    });

    // Lending Metrics
    this.lendingOperationsTotal = new Counter({
      name: 'lending_operations_total',
      help: 'Total number of lending operations',
      labelNames: ['operation', 'status'],
      registers: [this.register],
    });

    this.lendingOperationDuration = new Histogram({
      name: 'lending_operation_duration_seconds',
      help: 'Duration of lending operations in seconds',
      labelNames: ['operation'],
      buckets: [0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    this.lendingErrorsTotal = new Counter({
      name: 'lending_errors_total',
      help: 'Total number of lending errors',
      labelNames: ['error_type', 'operation'],
      registers: [this.register],
    });

    this.loansByStatus = new Gauge({
      name: 'loans_by_status',
      help: 'Number of loans by status',
      labelNames: ['status'],
      registers: [this.register],
    });

    // Chama Metrics
    this.chamaContributionErrors = new Counter({
      name: 'chama_contribution_errors_total',
      help: 'Total number of chama contribution errors',
      labelNames: ['chama_id'],
      registers: [this.register],
    });

    this.chamaPayoutFailures = new Counter({
      name: 'chama_payout_failures_total',
      help: 'Total number of chama payout failures',
      labelNames: ['chama_id'],
      registers: [this.register],
    });

    this.chamaOperationsTotal = new Counter({
      name: 'chama_operations_total',
      help: 'Total number of chama operations',
      labelNames: ['operation', 'status'],
      registers: [this.register],
    });

    // System Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register],
    });

    this.databaseConnectionStatus = new Gauge({
      name: 'database_connection_status',
      help: 'Database connection status (1=connected, 0=disconnected)',
      registers: [this.register],
    });

    this.redisConnectionStatus = new Gauge({
      name: 'redis_connection_status',
      help: 'Redis connection status (1=connected, 0=disconnected)',
      registers: [this.register],
    });

    this.logger.log('Metrics service initialized');
  }

  onModuleInit() {
    this.logger.log('Metrics service module initialized');
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Record investment operation
   */
  recordInvestmentOperation(
    operation: string,
    status: 'success' | 'error',
    duration?: number,
  ): void {
    this.investmentOperationsTotal.inc({ operation, status });
    if (duration !== undefined) {
      this.investmentOperationDuration.observe({ operation }, duration / 1000); // Convert ms to seconds
    }
  }

  /**
   * Record investment error
   */
  recordInvestmentError(errorType: string, operation: string): void {
    this.investmentErrorsTotal.inc({ error_type: errorType, operation });
  }

  /**
   * Update queue job count
   */
  updateQueueJobCount(queue: string, status: 'waiting' | 'active' | 'completed' | 'failed', count: number): void {
    this.queueJobsTotal.set({ status, queue }, count);
  }

  /**
   * Record queue job duration
   */
  recordQueueJobDuration(queue: string, jobType: string, duration: number): void {
    this.queueJobDuration.observe({ queue, job_type: jobType }, duration / 1000); // Convert ms to seconds
  }

  /**
   * Record queue job failure
   */
  recordQueueJobFailure(queue: string, jobType: string): void {
    this.queueJobFailures.inc({ queue, job_type: jobType });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(endpoint: string, userId?: string): void {
    this.rateLimitHitsTotal.inc({ endpoint, user_id: userId || 'unknown' });
  }

  /**
   * Record rate limit request
   */
  recordRateLimitRequest(endpoint: string, status: 'allowed' | 'limited'): void {
    this.rateLimitRequestsTotal.inc({ endpoint, status });
  }

  /**
   * Record idempotency hit
   */
  recordIdempotencyHit(endpoint: string): void {
    this.idempotencyHitsTotal.inc({ endpoint });
  }

  /**
   * Record idempotency miss
   */
  recordIdempotencyMiss(endpoint: string): void {
    this.idempotencyMissesTotal.inc({ endpoint });
  }

  /**
   * Update investment status count
   */
  updateInvestmentStatusCount(status: string, count: number): void {
    this.investmentsByStatus.set({ status }, count);
  }

  /**
   * Record investment amount
   */
  recordInvestmentAmount(productType: string, amount: number): void {
    this.investmentAmounts.observe({ product_type: productType }, amount);
  }

  /**
   * Record wallet transaction
   */
  recordWalletTransaction(
    transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'contribution' | 'payout',
    status: 'success' | 'error',
    duration?: number,
    amount?: number,
  ): void {
    this.walletTransactionTotal.inc({ transaction_type: transactionType, status });
    if (duration !== undefined) {
      this.walletTransactionDuration.observe({ transaction_type: transactionType }, duration / 1000);
    }
    if (amount !== undefined) {
      this.walletTransactionAmounts.observe({ transaction_type: transactionType }, amount);
    }
  }

  /**
   * Record wallet transaction error
   */
  recordWalletError(errorType: string, transactionType: string): void {
    this.walletTransactionErrors.inc({ error_type: errorType, transaction_type: transactionType });
  }

  /**
   * Record wallet balance check
   */
  recordWalletBalanceCheck(): void {
    this.walletBalanceChecks.inc();
  }

  /**
   * Record M-Pesa reconciliation failure
   */
  recordMpesaReconciliationFailure(reconciliationType: string): void {
    this.mpesaReconciliationFailures.inc({ reconciliation_type: reconciliationType });
  }

  /**
   * Record M-Pesa reconciliation success
   */
  recordMpesaReconciliationSuccess(reconciliationType: string): void {
    this.mpesaReconciliationSuccess.inc({ reconciliation_type: reconciliationType });
  }

  /**
   * Update wallet queue job count
   */
  updateWalletQueueJobCount(status: 'waiting' | 'active' | 'completed' | 'failed', jobType: string, count: number): void {
    this.walletQueueJobsTotal.set({ status, job_type: jobType }, count);
  }

  /**
   * Record ledger transaction
   */
  recordLedgerTransaction(
    transactionType: string,
    status: 'success' | 'error',
    duration?: number,
  ): void {
    this.ledgerTransactionTotal.inc({ transaction_type: transactionType, status });
    if (duration !== undefined) {
      this.ledgerTransactionDuration.observe({ transaction_type: transactionType }, duration / 1000);
    }
  }

  /**
   * Record ledger error
   */
  recordLedgerError(errorType: string, transactionType: string): void {
    this.ledgerErrorsTotal.inc({ error_type: errorType, transaction_type: transactionType });
  }

  /**
   * Update ledger reconciliation status
   */
  updateLedgerReconciliationStatus(reconciliationType: string, status: 'success' | 'failed'): void {
    this.ledgerReconciliationStatus.set({ reconciliation_type: reconciliationType }, status === 'success' ? 1 : 0);
  }

  /**
   * Update unbalanced transactions count
   */
  updateUnbalancedTransactionsCount(count: number): void {
    this.ledgerUnbalancedTransactions.set(count);
  }

  /**
   * Record lending operation
   */
  recordLendingOperation(
    operation: string,
    status: 'success' | 'error',
    duration?: number,
  ): void {
    this.lendingOperationsTotal.inc({ operation, status });
    if (duration !== undefined) {
      this.lendingOperationDuration.observe({ operation }, duration / 1000);
    }
  }

  /**
   * Record lending error
   */
  recordLendingError(errorType: string, operation: string): void {
    this.lendingErrorsTotal.inc({ error_type: errorType, operation });
  }

  /**
   * Update loans by status count
   */
  updateLoansByStatus(status: string, count: number): void {
    this.loansByStatus.set({ status }, count);
  }

  /**
   * Record chama contribution error
   */
  recordChamaContributionError(chamaId: string): void {
    this.chamaContributionErrors.inc({ chama_id: chamaId });
  }

  /**
   * Record chama payout failure
   */
  recordChamaPayoutFailure(chamaId: string): void {
    this.chamaPayoutFailures.inc({ chama_id: chamaId });
  }

  /**
   * Record chama operation
   */
  recordChamaOperation(
    operation: string,
    status: 'success' | 'error',
  ): void {
    this.chamaOperationsTotal.inc({ operation, status });
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, route: string, status: number): void {
    this.httpRequestsTotal.inc({ method, route, status: status.toString() });
  }

  /**
   * Update database connection status
   */
  updateDatabaseConnectionStatus(connected: boolean): void {
    this.databaseConnectionStatus.set(connected ? 1 : 0);
  }

  /**
   * Update Redis connection status
   */
  updateRedisConnectionStatus(connected: boolean): void {
    this.redisConnectionStatus.set(connected ? 1 : 0);
  }
}

