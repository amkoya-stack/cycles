import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../cache/redis.service';
import { MetricsService } from './metrics.service';

/**
 * Health Monitor Service
 * Periodically checks database and Redis connection status
 * Updates metrics for monitoring and alerting
 */
@Injectable()
export class HealthMonitorService implements OnModuleInit {
  private readonly logger = new Logger(HealthMonitorService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
    this.logger.log('Health Monitor Service initialized');
    // Run initial health check
    this.checkConnections();
  }

  /**
   * Check database and Redis connections every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkConnections(): Promise<void> {
    await Promise.all([
      this.checkDatabaseConnection(),
      this.checkRedisConnection(),
    ]);
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.db.query('SELECT 1');
      const duration = Date.now() - startTime;

      this.metrics.updateDatabaseConnectionStatus(true);

      // Log if connection is slow (> 1 second)
      if (duration > 1000) {
        this.logger.warn(
          `Database connection check took ${duration}ms (threshold: 1000ms)`,
        );
      }
    } catch (error) {
      this.metrics.updateDatabaseConnectionStatus(false);
      this.logger.error(
        `Database connection check failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedisConnection(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const duration = Date.now() - startTime;

      this.metrics.updateRedisConnectionStatus(true);

      // Log if connection is slow (> 500ms)
      if (duration > 500) {
        this.logger.warn(
          `Redis connection check took ${duration}ms (threshold: 500ms)`,
        );
      }
    } catch (error) {
      this.metrics.updateRedisConnectionStatus(false);
      this.logger.error(
        `Redis connection check failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manual health check endpoint (can be called via API)
   */
  async getHealthStatus(): Promise<{
    database: { connected: boolean; latency?: number };
    redis: { connected: boolean; latency?: number };
    timestamp: Date;
  }> {
    const results: {
      database: { connected: boolean; latency?: number };
      redis: { connected: boolean; latency?: number };
      timestamp: Date;
    } = {
      database: { connected: false },
      redis: { connected: false },
      timestamp: new Date(),
    };

    // Check database
    try {
      const dbStart = Date.now();
      await this.db.query('SELECT 1');
      const dbLatency = Date.now() - dbStart;
      results.database = { connected: true, latency: dbLatency };
    } catch (error) {
      results.database = { connected: false };
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await this.redis.ping();
      const redisLatency = Date.now() - redisStart;
      results.redis = { connected: true, latency: redisLatency };
    } catch (error) {
      results.redis = { connected: false };
    }

    return results;
  }
}

