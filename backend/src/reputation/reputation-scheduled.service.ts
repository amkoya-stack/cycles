/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChamaMetricsService } from '../chama/chama-metrics.service';
import { ReputationAutomationService } from './reputation-automation.service';

@Injectable()
export class ReputationScheduledService {
  private readonly logger = new Logger(ReputationScheduledService.name);

  constructor(
    private readonly reputationAutomation: ReputationAutomationService,
    @Inject(forwardRef(() => ChamaMetricsService))
    private readonly chamaMetrics: ChamaMetricsService,
  ) {}

  /**
   * Process pending reputation calculation events
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingReputationEvents() {
    this.logger.log('Processing pending reputation events...');
    try {
      const processed =
        await this.reputationAutomation.processPendingEvents(100);
      if (processed > 0) {
        this.logger.log(`Processed ${processed} reputation calculation events`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process reputation events: ${error.message}`,
      );
    }
  }

  /**
   * Calculate chama metrics
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async calculateDailyChamaMetrics() {
    this.logger.log('Calculating daily chama metrics...');
    try {
      const calculated = await this.chamaMetrics.calculateAllChamaMetrics();
      this.logger.log(`Calculated metrics for ${calculated} chamas`);
    } catch (error) {
      this.logger.error(`Failed to calculate chama metrics: ${error.message}`);
    }
  }

  /**
   * Clean up old reputation events
   * Runs weekly on Sunday at 3 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldEvents() {
    this.logger.log('Cleaning up old reputation events...');
    try {
      const deleted = await this.reputationAutomation.cleanupOldEvents(30);
      this.logger.log(`Deleted ${deleted} old reputation events`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old events: ${error.message}`);
    }
  }
}
