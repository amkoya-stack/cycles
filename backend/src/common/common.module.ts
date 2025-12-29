import { Module, Global } from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { ApiVersionGuard } from './guards/api-version.guard';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { TokenizationInterceptor } from './interceptors/tokenization.interceptor';
import { TokenizationService } from './services/tokenization.service';
import { FeatureFlagsService } from './services/feature-flags.service';
import { CanaryDeploymentService } from './services/canary-deployment.service';
import { RollbackService } from './services/rollback.service';
import { ChaosTestingService } from './services/chaos-testing.service';
import { RedisModule } from '../cache/redis.module';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [RedisModule, DatabaseModule],
  providers: [
    RateLimitGuard,
    IdempotencyInterceptor,
    ApiVersionGuard,
    FeatureFlagGuard,
    TokenizationInterceptor,
    TokenizationService,
    FeatureFlagsService,
    CanaryDeploymentService,
    RollbackService,
    ChaosTestingService,
  ],
  exports: [
    RateLimitGuard,
    IdempotencyInterceptor,
    ApiVersionGuard,
    FeatureFlagGuard,
    TokenizationInterceptor,
    TokenizationService,
    FeatureFlagsService,
    CanaryDeploymentService,
    RollbackService,
    ChaosTestingService,
  ],
})
export class CommonModule {}
