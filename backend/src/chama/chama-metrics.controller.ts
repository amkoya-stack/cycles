import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChamaMetricsService } from './chama-metrics.service';
import { ReputationAutomationService } from '../reputation/reputation-automation.service';

@Controller({ path: 'chama-metrics', version: '1' })
@UseGuards(JwtAuthGuard)
export class ChamaMetricsController {
  constructor(
    private readonly metricsService: ChamaMetricsService,
    private readonly reputationAutomation: ReputationAutomationService,
  ) {}

  /**
   * Get latest metrics for a chama
   */
  @Get(':chamaId')
  async getMetrics(@Param('chamaId') chamaId: string) {
    const metrics = await this.metricsService.getLatestMetrics(chamaId);
    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * Get metrics history
   */
  @Get(':chamaId/history')
  async getMetricsHistory(@Param('chamaId') chamaId: string) {
    const history = await this.metricsService.getMetricsHistory(chamaId, 12);
    return {
      success: true,
      data: history,
    };
  }

  /**
   * Calculate metrics for a chama (manual trigger)
   */
  @Post(':chamaId/calculate')
  async calculateMetrics(@Param('chamaId') chamaId: string) {
    const metrics = await this.metricsService.calculateMetrics(chamaId);
    return {
      success: true,
      message: 'Metrics calculated successfully',
      data: metrics,
    };
  }

  /**
   * Get top performing chamas
   */
  @Get('leaderboard/top')
  async getTopChamas() {
    const chamas = await this.metricsService.getTopPerformingChamas(10);
    return {
      success: true,
      data: chamas,
    };
  }

  /**
   * Recalculate reputation for all members in a chama
   */
  @Post(':chamaId/reputation/recalculate')
  async recalculateReputation(@Param('chamaId') chamaId: string) {
    const processed =
      await this.reputationAutomation.recalculateAllForChama(chamaId);
    return {
      success: true,
      message: `Queued reputation calculation for ${processed} members`,
      data: { processed },
    };
  }
}
