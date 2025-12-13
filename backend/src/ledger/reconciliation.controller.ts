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

@Controller('reconciliation')
@UseGuards(JwtAuthGuard)
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    @InjectQueue('reconciliation') private reconciliationQueue: Queue,
  ) {}

  /**
   * Trigger manual reconciliation
   * POST /api/reconciliation/run
   */
  @Post('run')
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
   * Get reconciliation history
   * GET /api/reconciliation/history?limit=30
   */
  @Get('history')
  async getHistory(@Query('limit') limit?: number) {
    const runs = await this.reconciliationService.getReconciliationHistory(
      limit ? parseInt(limit.toString()) : 30,
    );
    return { runs };
  }

  /**
   * Get reconciliation run details
   * GET /api/reconciliation/:runId
   */
  @Get(':runId')
  async getRunDetails(@Param('runId') runId: string) {
    const details =
      await this.reconciliationService.getReconciliationDetails(runId);
    return details;
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
