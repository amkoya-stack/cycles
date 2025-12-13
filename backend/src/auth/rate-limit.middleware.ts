import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../cache/redis.service';

type Key = string;

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly windowSec = 60;
  private readonly max = 5;

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.keyFromRequest(req);
    const rateLimitKey = `rate_limit:${key}`;

    try {
      const current = await this.redis.get(rateLimitKey);

      if (!current) {
        // First request in window
        await this.redis.set(rateLimitKey, '1', this.windowSec);
        return next();
      }

      const count = parseInt(current, 10);
      if (count >= this.max) {
        throw new BadRequestException(
          'Too many requests, please try again later',
        );
      }

      // Increment counter (Redis INCR with TTL preservation)
      await this.redis.incr(rateLimitKey);
      next();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // If Redis fails, allow request (fail open)
      console.error('Rate limit Redis error:', error);
      next();
    }
  }

  private keyFromRequest(req: Request): Key {
    const dest =
      (req.body?.destination as string) ||
      (req.body?.email as string) ||
      (req.body?.phone as string) ||
      '';
    const ip =
      (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    return `${req.path}|${dest}|${ip}`;
  }
}
