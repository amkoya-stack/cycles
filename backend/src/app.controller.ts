import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthMonitorService } from './common/services/health-monitor.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly healthMonitor: HealthMonitorService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    return this.healthMonitor.getHealthStatus();
  }
}
