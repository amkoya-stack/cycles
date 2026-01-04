import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SentryService } from './sentry.service';
import { DataDogService } from './datadog.service';

/**
 * Interceptor to automatically send metrics and errors to monitoring services
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(
    private readonly sentry: SentryService,
    private readonly datadog: DataDogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();
    const controller = context.getClass();

    const startTime = Date.now();
    const userId = request.user?.id;
    const method = request.method;
    const path = request.url.split('?')[0]; // Remove query params

    // Set Sentry user context
    if (userId) {
      this.sentry.setUser({ id: userId });
    }

    // Add breadcrumb
    this.sentry.addBreadcrumb({
      message: `${method} ${path}`,
      category: 'http',
      level: 'info',
      data: {
        method,
        path,
        controller: controller.name,
        handler: handler.name,
      },
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Record metrics to DataDog
          this.datadog.increment('api.requests', 1, [
            `method:${method}`,
            `path:${path}`,
            `status:${statusCode}`,
          ]);

          this.datadog.timing('api.response_time', duration, [
            `method:${method}`,
            `path:${path}`,
          ]);

          // Record success metrics
          if (statusCode >= 200 && statusCode < 300) {
            this.datadog.increment('api.success', 1, [`path:${path}`]);
          }
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Record error metrics
        this.datadog.increment('api.errors', 1, [
          `method:${method}`,
          `path:${path}`,
          `status:${statusCode}`,
        ]);

        // Send to Sentry
        this.sentry.captureException(error, {
          request: {
            method,
            path,
            userId,
            controller: controller.name,
            handler: handler.name,
          },
          response: {
            statusCode,
            duration,
          },
        });

        // Record error event in DataDog
        this.datadog.event('API Error', error.message, {
          alertType: 'error',
          priority: statusCode >= 500 ? 'normal' : 'low',
          tags: [`path:${path}`, `method:${method}`, `status:${statusCode}`],
        });

        return throwError(() => error);
      }),
    );
  }
}

