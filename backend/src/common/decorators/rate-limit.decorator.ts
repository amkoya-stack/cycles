// backend/src/common/decorators/rate-limit.decorator.ts
import { SetMetadata } from '@nestjs/common';

export interface RateLimitConfig {
  window: number; // Time window in seconds
  max: number; // Maximum requests per window
  keyGenerator?: 'user' | 'ip' | 'combined'; // How to generate rate limit key
}

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);
