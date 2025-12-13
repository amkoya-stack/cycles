/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ReconciliationService } from './reconciliation.service';

@Processor('reconciliation')
export class ReconciliationProcessor {
  private readonly logger = new Logger(ReconciliationProcessor.name);

  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * Process daily reconciliation job
   * Scheduled by Bull queue
   */
  @Process('daily-reconciliation')
  async handleDailyReconciliation(job: Job): Promise<void> {
    this.logger.log(`Processing daily reconciliation job #${job.id}`);

    try {
      const result = await this.reconciliationService.runDailyReconciliation();

      this.logger.log(
        `Daily reconciliation completed: ${result.status}, ${result.mismatchCount} issues found`,
      );

      // Update job with result
      await job.progress(100);
      return;
    } catch (error) {
      this.logger.error(
        `Daily reconciliation failed: ${error.message}`,
        error.stack,
      );
      throw error; // Bull will retry based on configuration
    }
  }

  /**
   * Process hourly balance check (lightweight)
   */
  @Process('hourly-check')
  async handleHourlyCheck(job: Job): Promise<void> {
    this.logger.log(`Processing hourly balance check job #${job.id}`);

    try {
      // Quick sanity check - just verify ledger is balanced
      const balanceCheck =
        await this.reconciliationService['checkLedgerBalance']();

      if (!balanceCheck.isBalanced) {
        this.logger.error(
          `⚠️ LEDGER IMBALANCE DETECTED: Difference of ${balanceCheck.difference}`,
        );
        // Trigger immediate full reconciliation
        await this.reconciliationService.runDailyReconciliation();
      } else {
        this.logger.log('✅ Hourly check passed: Ledger is balanced');
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(`Hourly check failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process manual reconciliation request
   */
  @Process('manual-reconciliation')
  async handleManualReconciliation(job: Job): Promise<void> {
    this.logger.log(
      `Processing manual reconciliation job #${job.id} initiated by ${job.data.userId}`,
    );

    try {
      const result = await this.reconciliationService.runDailyReconciliation();

      this.logger.log(
        `Manual reconciliation completed: ${result.status}, ${result.mismatchCount} issues found`,
      );

      await job.progress(100);
      return;
    } catch (error) {
      this.logger.error(
        `Manual reconciliation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
