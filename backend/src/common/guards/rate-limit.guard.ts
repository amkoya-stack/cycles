/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../cache/redis.service';
import { RateLimitConfig } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    // Get rate limit config from decorator or use defaults
    const config =
      this.reflector.get<RateLimitConfig>('rateLimit', handler) ||
      this.getDefaultConfig(request.path);

    const key = this.getRateLimitKey(request, config);
    const windowKey = `${key}:window`;

    try {
      // Use sliding window algorithm
      const current = await this.redis.incr(key);

      // Set expiration on first request
      if (current === 1) {
        await this.redis.expire(key, config.window);
        await this.redis.expire(windowKey, config.window);
      }

      // Check if limit exceeded
      if (current > config.max) {
        const ttl = await this.redis.getClient().ttl(key);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded. Maximum ${config.max} requests per ${config.window} seconds.`,
            retryAfter: ttl > 0 ? ttl : config.window,
            limit: config.max,
            window: config.window,
            remaining: 0,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Set response headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', config.max);
      response.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, config.max - current),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        Date.now() + config.window * 1000,
      );

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Fail open if Redis is unavailable
      console.error('[RateLimit] Redis error:', error);
      return true;
    }
  }

  private getRateLimitKey(request: any, config: RateLimitConfig): string {
    const userId = request.user?.id || 'anonymous';
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.ip ||
      'unknown';
    const path = request.path;

    // Different key strategies based on config
    if (config.keyGenerator === 'user') {
      return `rate_limit:user:${userId}:${path}`;
    } else if (config.keyGenerator === 'ip') {
      return `rate_limit:ip:${ip}:${path}`;
    } else {
      // Default: combine user and IP
      return `rate_limit:${userId}:${ip}:${path}`;
    }
  }

  private getDefaultConfig(path: string): RateLimitConfig {
    // Stricter limits for financial endpoints
    if (
      path.includes('/wallet/') ||
      path.includes('/ledger/') ||
      path.includes('/mpesa/') ||
      (path.includes('/chama/') &&
        (path.includes('/contribution') || path.includes('/payout')))
    ) {
      return {
        window: 60,
        max: 10,
        keyGenerator: 'user',
      };
    }

    // Moderate limits for write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(path)) {
      return {
        window: 60,
        max: 30,
        keyGenerator: 'user',
      };
    }

    // Lenient limits for read operations
    return {
      window: 60,
      max: 100,
      keyGenerator: 'ip',
    };
  }
}
