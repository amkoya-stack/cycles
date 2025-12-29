/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../cache/redis.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const idempotencyKey = request.headers['idempotency-key'] as string;

    // Only apply to state-changing methods
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return next.handle();
    }

    // If no idempotency key provided, allow request but log warning
    if (!idempotencyKey) {
      console.warn(
        `[Idempotency] No idempotency-key header for ${method} ${request.path}`,
      );
      return next.handle();
    }

    // Validate idempotency key format (UUID or custom format)
    if (!this.isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException(
        'Invalid idempotency-key format. Must be UUID or alphanumeric (max 255 chars)',
      );
    }

    const cacheKey = `idempotency:${idempotencyKey}:${request.path}:${method}`;

    try {
      // Check if we've seen this request before
      const cachedResponse = await this.redis.get(cacheKey);

      if (cachedResponse) {
        console.log(
          `[Idempotency] Returning cached response for key: ${idempotencyKey}`,
        );
        const parsed = JSON.parse(cachedResponse);
        return of(parsed);
      }

      // Execute request and cache response
      return next.handle().pipe(
        tap(async (response) => {
          try {
            // Cache successful responses for 24 hours
            await this.redis.set(
              cacheKey,
              JSON.stringify(response),
              86400, // 24 hours
            );
            console.log(
              `[Idempotency] Cached response for key: ${idempotencyKey}`,
            );
          } catch (error) {
            console.error('[Idempotency] Failed to cache response:', error);
            // Don't fail the request if caching fails
          }
        }),
      );
    } catch (error) {
      console.error('[Idempotency] Redis error:', error);
      // Fail open - allow request if Redis fails
      return next.handle();
    }
  }

  private isValidIdempotencyKey(key: string): boolean {
    // UUID format or alphanumeric with dashes/underscores, max 255 chars
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const customRegex = /^[a-zA-Z0-9_-]{1,255}$/;
    return uuidRegex.test(key) || customRegex.test(key);
  }
}
