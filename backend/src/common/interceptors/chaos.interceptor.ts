import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChaosTestingService, ChaosType } from '../services/chaos-testing.service';

@Injectable()
export class ChaosInterceptor implements NestInterceptor {
  constructor(private readonly chaos: ChaosTestingService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const endpoint = request.url;
    const userId = request.user?.id;

    // Check if chaos should be injected
    const rule = await this.chaos.shouldInjectChaos({
      endpoint,
      userId,
    });

    if (!rule) {
      return next.handle();
    }

    // Inject chaos based on rule type
    switch (rule.type) {
      case ChaosType.LATENCY:
        if (rule.config.latencyMs) {
          await this.chaos.injectLatency(rule.config.latencyMs);
        }
        break;

      case ChaosType.ERROR:
        if (rule.config.errorCode && rule.config.errorMessage) {
          this.chaos.injectError(
            rule.config.errorCode,
            rule.config.errorMessage,
          );
        }
        break;

      case ChaosType.TIMEOUT:
        // Timeout is handled by the framework, we just inject latency
        if (rule.config.timeoutMs) {
          await this.chaos.injectLatency(rule.config.timeoutMs);
        }
        break;

      case ChaosType.DATABASE_FAILURE:
        await this.chaos.simulateDatabaseFailure();
        break;

      case ChaosType.REDIS_FAILURE:
        await this.chaos.simulateRedisFailure();
        break;

      case ChaosType.RANDOM_FAILURE:
        // Randomly choose between error, latency, or database failure
        const random = Math.random();
        if (random < 0.33) {
          this.chaos.injectError(500, 'Random failure: Internal server error');
        } else if (random < 0.66) {
          await this.chaos.injectLatency(1000 + Math.random() * 2000);
        } else {
          await this.chaos.simulateDatabaseFailure();
        }
        break;
    }

    return next.handle();
  }
}

