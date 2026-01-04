import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DataDogService implements OnModuleInit {
  private readonly logger = new Logger(DataDogService.name);
  private statsd: any;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('DATADOG_API_KEY');
    const appKey = this.configService.get<string>('DATADOG_APP_KEY');

    if (!apiKey || !appKey) {
      this.logger.warn(
        'DATADOG_API_KEY or DATADOG_APP_KEY not configured, DataDog monitoring disabled',
      );
      return;
    }

    try {
      // Dynamic import to avoid requiring datadog in dev
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const StatsD = require('node-statsd');
      
      this.statsd = new StatsD({
        host: this.configService.get<string>('DATADOG_HOST') || 'localhost',
        port: this.configService.get<number>('DATADOG_PORT') || 8125,
        prefix: this.configService.get<string>('DATADOG_PREFIX') || 'cycles.',
      });

      this.logger.log('DataDog initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DataDog:', error);
    }
  }

  /**
   * Increment counter
   */
  increment(metric: string, value: number = 1, tags?: string[]): void {
    if (!this.statsd) return;

    try {
      this.statsd.increment(metric, value, tags);
    } catch (error) {
      this.logger.error(`Failed to increment metric ${metric}:`, error);
    }
  }

  /**
   * Decrement counter
   */
  decrement(metric: string, value: number = 1, tags?: string[]): void {
    if (!this.statsd) return;

    try {
      this.statsd.decrement(metric, value, tags);
    } catch (error) {
      this.logger.error(`Failed to decrement metric ${metric}:`, error);
    }
  }

  /**
   * Record gauge value
   */
  gauge(metric: string, value: number, tags?: string[]): void {
    if (!this.statsd) return;

    try {
      this.statsd.gauge(metric, value, tags);
    } catch (error) {
      this.logger.error(`Failed to record gauge ${metric}:`, error);
    }
  }

  /**
   * Record histogram value
   */
  histogram(metric: string, value: number, tags?: string[]): void {
    if (!this.statsd) return;

    try {
      this.statsd.histogram(metric, value, tags);
    } catch (error) {
      this.logger.error(`Failed to record histogram ${metric}:`, error);
    }
  }

  /**
   * Record timing value (in milliseconds)
   */
  timing(metric: string, value: number, tags?: string[]): void {
    if (!this.statsd) return;

    try {
      this.statsd.timing(metric, value, tags);
    } catch (error) {
      this.logger.error(`Failed to record timing ${metric}:`, error);
    }
  }

  /**
   * Record custom event
   */
  event(title: string, text: string, options?: {
    alertType?: 'info' | 'warning' | 'error' | 'success';
    priority?: 'low' | 'normal';
    tags?: string[];
  }): void {
    if (!this.statsd) return;

    try {
      this.statsd.event(title, text, options);
    } catch (error) {
      this.logger.error(`Failed to record event ${title}:`, error);
    }
  }
}

