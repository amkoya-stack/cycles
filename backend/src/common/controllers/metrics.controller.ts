import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';

/**
 * Metrics Controller
 * Exposes Prometheus metrics endpoint at /metrics
 */
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Get Prometheus metrics
   * GET /metrics
   */
  @Get('metrics')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}

