import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../services/metrics.service';

/**
 * HTTP Metrics Interceptor
 * Records all HTTP requests for monitoring
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Extract route information
    const method = request.method;
    const route = request.route?.path || request.path || 'unknown';
    // Normalize route to remove IDs and make it more generic
    const normalizedRoute = this.normalizeRoute(route);

    // Record request when response finishes
    response.on('finish', () => {
      const statusCode = response.statusCode;
      this.metrics.recordHttpRequest(method, normalizedRoute, statusCode);
    });

    return next.handle().pipe(
      tap({
        error: () => {
          // Error is already handled by the 'finish' event above
          // But we can add additional error-specific metrics here if needed
        },
      }),
    );
  }

  /**
   * Normalize route to remove dynamic segments (IDs, UUIDs, etc.)
   * Example: /api/v1/users/123 -> /api/v1/users/:id
   */
  private normalizeRoute(route: string): string {
    // Remove UUIDs (8-4-4-4-12 format)
    let normalized = route.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );

    // Remove numeric IDs at the end of paths
    normalized = normalized.replace(/\/\d+(\/|$)/g, '/:id$1');

    // Remove query strings
    normalized = normalized.split('?')[0];

    return normalized;
  }
}

