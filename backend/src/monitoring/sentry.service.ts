import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly logger = new Logger(SentryService.name);
  private sentry: any;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    if (!dsn) {
      this.logger.warn('SENTRY_DSN not configured, Sentry monitoring disabled');
      return;
    }

    try {
      // Dynamic import to avoid requiring sentry in dev
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/node');
      
      Sentry.init({
        dsn,
        environment: this.configService.get<string>('NODE_ENV') || 'development',
        tracesSampleRate: this.configService.get<number>('SENTRY_TRACES_SAMPLE_RATE') || 0.1,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: undefined }),
        ],
      });

      this.sentry = Sentry;
      this.logger.log('Sentry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Sentry:', error);
    }
  }

  /**
   * Capture exception
   */
  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.sentry) return;

    try {
      this.sentry.withScope((scope: any) => {
        if (context) {
          Object.keys(context).forEach((key) => {
            scope.setContext(key, context[key]);
          });
        }
        this.sentry.captureException(error);
      });
    } catch (err) {
      this.logger.error('Failed to capture exception in Sentry:', err);
    }
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.sentry) return;

    try {
      this.sentry.captureMessage(message, level);
    } catch (error) {
      this.logger.error('Failed to capture message in Sentry:', error);
    }
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.sentry) return;

    try {
      this.sentry.setUser(user);
    } catch (error) {
      this.logger.error('Failed to set user in Sentry:', error);
    }
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, any>;
  }): void {
    if (!this.sentry) return;

    try {
      this.sentry.addBreadcrumb(breadcrumb);
    } catch (error) {
      this.logger.error('Failed to add breadcrumb in Sentry:', error);
    }
  }
}

