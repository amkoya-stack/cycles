/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ReconciliationService } from './reconciliation.service';

@Controller({ path: 'reconciliation', version: '1' })
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    @InjectQueue('reconciliation') private reconciliationQueue: Queue,
  ) {}

  /**
   * Quick ledger health check (no auth required for testing)
   * GET /api/reconciliation/health
   */
  @Get('health')
  async quickHealthCheck() {
    const result = await this.reconciliationService.runDailyReconciliation();
    return {
      status:
        result.status === 'completed' && result.isBalanced
          ? 'HEALTHY'
          : 'ISSUES_FOUND',
      runId: result.runId,
      isBalanced: result.isBalanced,
      ledgerBalance: result.ledgerBalance,
      difference: result.difference,
      mismatchCount: result.mismatchCount,
      mismatches: result.mismatches,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      summary: {
        ledgerIsBalanced: result.isBalanced,
        totalMismatches: result.mismatchCount,
        statusOk: result.status === 'completed',
      },
    };
  }

  /**
   * Get reconciliation history
   * GET /api/reconciliation/history?limit=30
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Query('limit') limit?: number) {
    const runs = await this.reconciliationService.getReconciliationHistory(
      limit ? parseInt(limit.toString()) : 30,
    );
    return { runs };
  }

  /**
   * Get reconciliation queue status
   * GET /api/reconciliation/queue/status
   */
  @Get('queue/status')
  async getQueueStatus() {
    const waiting = await this.reconciliationQueue.getWaitingCount();
    const active = await this.reconciliationQueue.getActiveCount();
    const completed = await this.reconciliationQueue.getCompletedCount();
    const failed = await this.reconciliationQueue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  }

  /**
   * Get reconciliation run details
   * GET /api/reconciliation/:runId
   * NOTE: This must be last to avoid catching specific routes like 'health', 'history', etc.
   */
  @Get(':runId')
  async getRunDetails(@Param('runId') runId: string) {
    const details =
      await this.reconciliationService.getReconciliationDetails(runId);
    return details;
  }

  /**
   * Trigger manual reconciliation
   * POST /api/reconciliation/run
   */
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async triggerReconciliation(@Req() req: any) {
    // Add job to queue
    const job = await this.reconciliationQueue.add('manual-reconciliation', {
      userId: req.user.id,
      triggeredAt: new Date(),
    });

    return {
      message: 'Reconciliation job queued',
      jobId: job.id,
    };
  }

  /**
   * Schedule daily reconciliation job
   * POST /api/reconciliation/schedule/daily
   */
  @Post('schedule/daily')
  async scheduleDailyReconciliation() {
    // Add repeatable job - runs every day at 2 AM
    await this.reconciliationQueue.add(
      'daily-reconciliation',
      {},
      {
        repeat: {
          cron: '0 2 * * *', // 2 AM daily
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    return {
      message: 'Daily reconciliation scheduled for 2 AM',
    };
  }

  /**
   * Schedule hourly balance checks
   * POST /api/reconciliation/schedule/hourly
   */
  @Post('schedule/hourly')
  async scheduleHourlyChecks() {
    // Add repeatable job - runs every hour
    await this.reconciliationQueue.add(
      'hourly-check',
      {},
      {
        repeat: {
          cron: '0 * * * *', // Every hour at :00
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      message: 'Hourly balance checks scheduled',
    };
  }

  /**
   * Trigger M-Pesa reconciliation
   * POST /api/reconciliation/mpesa
   */
  @Post('mpesa')
  async triggerMpesaReconciliation() {
    const result =
      await this.reconciliationService.reconcileMpesaTransactions();
    return result;
  }
}
