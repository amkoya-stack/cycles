import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../cache/redis.module';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { MetricsService } from './services/metrics.service';
import { TokenizationService } from './services/tokenization.service';
import { FeatureFlagsService } from './services/feature-flags.service';
import { CanaryDeploymentService } from './services/canary-deployment.service';
import { RollbackService } from './services/rollback.service';
import { HealthMonitorService } from './services/health-monitor.service';
import { HttpMetricsInterceptor } from './interceptors/http-metrics.interceptor';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule],
  providers: [
    RateLimitGuard,
    FeatureFlagGuard,
    MetricsService,
    TokenizationService,
    FeatureFlagsService,
    CanaryDeploymentService,
    RollbackService,
    HealthMonitorService,
    HttpMetricsInterceptor,
  ],
  exports: [
    RateLimitGuard,
    FeatureFlagGuard,
    MetricsService,
    TokenizationService,
    FeatureFlagsService,
    CanaryDeploymentService,
    RollbackService,
    HealthMonitorService,
    HttpMetricsInterceptor,
  ],
})
export class CommonModule {}
