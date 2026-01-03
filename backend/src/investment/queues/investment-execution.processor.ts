/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Process, Processor } from '@nestjs/bull';
import { Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import type { Job } from 'bull';
import { DatabaseService } from '../../database/database.service';
import { mapQueryRow } from '../../database/mapper.util';
import { LedgerService } from '../../ledger/ledger.service';
import { RedisService } from '../../cache/redis.service';
import { InvestmentService } from '../investment.service';

export interface ExecuteInvestmentJob {
  investmentId: string;
  executedBy: string;
  idempotencyKey: string;
  externalReference: string;
}

export interface DistributeDividendJob {
  investmentId: string;
  amount: number;
  periodStart?: Date;
  periodEnd?: Date;
  distributedBy: string;
  idempotencyKey: string;
  externalReference: string;
}

@Processor('investment-executions')
export class InvestmentExecutionProcessor {
  private readonly logger = new Logger(InvestmentExecutionProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => InvestmentService))
    private readonly investmentService: InvestmentService,
  ) {}

  @Process('execute-investment')
  async handleExecuteInvestment(job: Job<ExecuteInvestmentJob>) {
    const { investmentId, executedBy, idempotencyKey, externalReference } = job.data;
    const jobStartTime = Date.now();

    this.logger.log(
      `[QUEUE_EXECUTE_INVESTMENT] Processing investment execution job - ` +
      `jobId: ${job.id}, investmentId: ${investmentId}, ` +
      `executedBy: ${executedBy}, idempotencyKey: ${idempotencyKey}, ` +
      `externalReference: ${externalReference}, attempt: ${job.attemptsMade + 1}`,
    );

    try {
      // Idempotency check
      this.logger.debug(`[QUEUE_EXECUTE_INVESTMENT] Checking idempotency - idempotencyKey: ${idempotencyKey}`);
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `[QUEUE_EXECUTE_INVESTMENT] Idempotent request - returning existing result - ` +
          `jobId: ${job.id}, idempotencyKey: ${idempotencyKey}, ` +
          `investmentId: ${investmentId}`,
        );
        return existing;
      }
      this.logger.debug(`[QUEUE_EXECUTE_INVESTMENT] No existing execution found, proceeding`);

      await this.db.setSystemContext();

      try {
        // Get investment details
        this.logger.debug(`[QUEUE_EXECUTE_INVESTMENT] Fetching investment details - investmentId: ${investmentId}`);
        const investmentResult = await this.db.query(
          `SELECT i.*, p.name as product_name, c.name as chama_name
           FROM investments i
           JOIN investment_products p ON i.product_id = p.id
           JOIN chamas c ON i.chama_id = c.id
           WHERE i.id = $1`,
          [investmentId],
        );

        if (investmentResult.rowCount === 0) {
          this.logger.error(
            `[QUEUE_EXECUTE_INVESTMENT] Investment not found - ` +
            `jobId: ${job.id}, investmentId: ${investmentId}`,
          );
          throw new NotFoundException('Investment not found');
        }

        const investment = mapQueryRow(investmentResult.rows[0]);
        this.logger.debug(
          `[QUEUE_EXECUTE_INVESTMENT] Investment fetched - ` +
          `investmentId: ${investmentId}, status: ${investment.status}, ` +
          `chamaId: ${investment.chama_id}, amount: ${investment.amount}, ` +
          `productName: ${investment.product_name}`,
        );

        if (investment.status !== 'approved') {
          this.logger.warn(
            `[QUEUE_EXECUTE_INVESTMENT] Invalid investment status - ` +
            `jobId: ${job.id}, investmentId: ${investmentId}, ` +
            `status: ${investment.status}, expected: approved`,
          );
          throw new BadRequestException(
            `Investment is not approved. Current status: ${investment.status}`,
          );
        }

        // Verify chama has sufficient balance
        this.logger.debug(
          `[QUEUE_EXECUTE_INVESTMENT] Checking chama balance - ` +
          `chamaId: ${investment.chama_id}, requiredAmount: ${investment.amount}`,
        );
        const chamaBalance = await this.ledger.getChamaBalance(investment.chama_id);
        this.logger.debug(
          `[QUEUE_EXECUTE_INVESTMENT] Chama balance checked - ` +
          `chamaId: ${investment.chama_id}, balance: ${chamaBalance}, ` +
          `required: ${investment.amount}`,
        );

        if (chamaBalance < investment.amount) {
          this.logger.error(
            `[QUEUE_EXECUTE_INVESTMENT] Insufficient chama balance - ` +
            `jobId: ${job.id}, investmentId: ${investmentId}, ` +
            `chamaId: ${investment.chama_id}, balance: ${chamaBalance}, ` +
            `required: ${investment.amount}`,
          );
          throw new BadRequestException(
            `Insufficient chama balance. Available: ${chamaBalance}, Required: ${investment.amount}`,
          );
        }

        // Create or get investment account for this investment
        let investmentAccount;
        try {
          this.logger.debug(`[QUEUE_EXECUTE_INVESTMENT] Fetching INVESTMENT account`);
          investmentAccount = await this.ledger.getSystemAccount('INVESTMENT');
          this.logger.debug(`[QUEUE_EXECUTE_INVESTMENT] INVESTMENT account found - accountId: ${investmentAccount.id}`);
        } catch (error: any) {
          this.logger.warn(
            `[QUEUE_EXECUTE_INVESTMENT] INVESTMENT account not found - ` +
            `investmentId: ${investmentId}, error: ${error.message}`,
          );
        }

        // Transfer funds from chama wallet to investment account
        this.logger.log(
          `[QUEUE_EXECUTE_INVESTMENT] Committing funds to investment - ` +
          `investmentId: ${investmentId}, chamaId: ${investment.chama_id}, ` +
          `amount: ${investment.amount}, externalReference: ${externalReference}`,
        );
        // For now, we track the investment without actual fund transfer
        // The funds remain in chama wallet but are marked as committed to investment
        // In a full implementation with investment accounts:
        // await this.ledger.processChamaTransfer({
        //   sourceChamaId: investment.chama_id,
        //   destinationType: 'investment',
        //   amount: investment.amount,
        //   reason: `Investment in ${investment.product_name}`,
        //   initiatedBy: executedBy,
        //   externalReference: externalReference,
        // });
        this.logger.debug(`[QUEUE_EXECUTE_INVESTMENT] Fund transfer marked (implementation pending)`);

        // Update investment status
        this.logger.debug(
          `[QUEUE_EXECUTE_INVESTMENT] Updating investment status to active - ` +
          `investmentId: ${investmentId}`,
        );
        const updateResult = await this.db.query(
          `UPDATE investments 
           SET status = 'active', 
               investment_date = NOW(),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [investmentId],
        );

        const result = mapQueryRow(updateResult.rows[0]);
        const duration = Date.now() - jobStartTime;

        this.logger.log(
          `[QUEUE_EXECUTE_INVESTMENT] Investment execution completed successfully - ` +
          `jobId: ${job.id}, investmentId: ${investmentId}, ` +
          `chamaId: ${investment.chama_id}, amount: ${investment.amount}, ` +
          `status: ${result.status}, duration: ${duration}ms`,
        );

        // Mark idempotency
        await this.markIdempotency(idempotencyKey, result);

        return result;
      } finally {
        await this.db.clearContext();
      }
    } catch (error: any) {
      const duration = Date.now() - jobStartTime;
      this.logger.error(
        `[QUEUE_EXECUTE_INVESTMENT] Investment execution failed - ` +
        `jobId: ${job.id}, investmentId: ${investmentId}, ` +
        `executedBy: ${executedBy}, idempotencyKey: ${idempotencyKey}, ` +
        `attempt: ${job.attemptsMade + 1}, duration: ${duration}ms, ` +
        `error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('distribute-dividend')
  async handleDistributeDividend(job: Job<DistributeDividendJob>) {
    const {
      investmentId,
      amount,
      periodStart,
      periodEnd,
      distributedBy,
      idempotencyKey,
      externalReference,
    } = job.data;

    this.logger.log(
      `Processing dividend distribution job ${job.id}: investment ${investmentId}, amount ${amount}`,
    );

    try {
      // Idempotency check
      const existing = await this.checkIdempotency(idempotencyKey);
      if (existing) {
        this.logger.log(
          `Dividend distribution already processed for idempotency key: ${idempotencyKey}`,
        );
        return existing;
      }

      // Use the investment service internal method to distribute dividend
      const result = await this.investmentService._distributeDividendInternal({
        investmentId,
        amount,
        paymentDate: new Date(),
        periodStart,
        periodEnd,
        distributedBy,
        distributeToWallet: true, // Default to wallet distribution
        externalReference,
        idempotencyKey,
      });

      // Mark idempotency
      await this.markIdempotency(idempotencyKey, result);

      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to distribute dividend for investment ${investmentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async checkIdempotency(idempotencyKey: string): Promise<any | null> {
    if (!idempotencyKey) {
      this.logger.debug(`[IDEMPOTENCY] No idempotency key provided`);
      return null;
    }

    try {
      const cacheKey = `idempotency:investment:${idempotencyKey}`;
      this.logger.debug(`[IDEMPOTENCY] Checking Redis cache - key: ${cacheKey}`);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`[IDEMPOTENCY] Found cached result - idempotencyKey: ${idempotencyKey}`);
        return JSON.parse(cached);
      }
      this.logger.debug(`[IDEMPOTENCY] No cached result found - idempotencyKey: ${idempotencyKey}`);
    } catch (error: any) {
      this.logger.warn(
        `[IDEMPOTENCY] Failed to check idempotency - ` +
        `idempotencyKey: ${idempotencyKey}, error: ${error.message}`,
      );
    }

    return null;
  }

  private async markIdempotency(idempotencyKey: string, result: any): Promise<void> {
    if (!idempotencyKey) {
      this.logger.debug(`[IDEMPOTENCY] No idempotency key provided, skipping mark`);
      return;
    }

    try {
      const cacheKey = `idempotency:investment:${idempotencyKey}`;
      this.logger.debug(
        `[IDEMPOTENCY] Marking idempotency in Redis - ` +
        `key: ${cacheKey}, ttl: 86400s (24h)`,
      );
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        86400, // 24 hours (TTL in seconds)
      );
      this.logger.debug(`[IDEMPOTENCY] Idempotency marked successfully - idempotencyKey: ${idempotencyKey}`);
    } catch (error: any) {
      this.logger.warn(
        `[IDEMPOTENCY] Failed to mark idempotency - ` +
        `idempotencyKey: ${idempotencyKey}, error: ${error.message}`,
      );
    }
  }
}

