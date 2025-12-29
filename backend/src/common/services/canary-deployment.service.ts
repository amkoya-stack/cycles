/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../cache/redis.service';
import { FeatureFlagsService, FeatureFlagType, FeatureFlagStatus } from './feature-flags.service';
import { v4 as uuidv4 } from 'uuid';

export interface CanaryDeployment {
  id: string;
  featureKey: string;
  version: string; // 'v1' (old) or 'v2' (new)
  percentage: number; // 0-100
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'rolled_back';
  metrics: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    avgResponseTime: number;
  };
  rollbackThreshold?: number; // Auto-rollback if error rate exceeds this
  createdBy?: string;
}

export interface CanaryMetrics {
  successCount: number;
  errorCount: number;
  totalRequests: number;
  avgResponseTime: number;
}

@Injectable()
export class CanaryDeploymentService {
  private readonly logger = new Logger(CanaryDeploymentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  /**
   * Start a canary deployment
   */
  async startCanary(
    featureKey: string,
    version: string,
    initialPercentage: number = 5,
    rollbackThreshold: number = 5, // 5% error rate
    createdBy?: string,
  ): Promise<CanaryDeployment> {
    // Create or update feature flag for canary
    const flag = await this.featureFlags.getFlag(featureKey);
    if (!flag) {
      throw new Error(`Feature flag '${featureKey}' not found`);
    }

    // Update flag to percentage type with initial percentage
    await this.featureFlags.updateFlag(featureKey, {
      type: FeatureFlagType.PERCENTAGE,
      percentage: initialPercentage,
      status: FeatureFlagStatus.ACTIVE,
      enabled: true,
      metadata: {
        canary: true,
        version,
        rollbackThreshold,
      },
    });

    // Create canary deployment record
    const id = uuidv4();
    const now = new Date();

    await this.db.query(
      `INSERT INTO canary_deployments (
        id, feature_key, version, percentage, start_time, status,
        rollback_threshold, created_by, metrics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        featureKey,
        version,
        initialPercentage,
        now,
        'active',
        rollbackThreshold,
        createdBy || null,
        JSON.stringify({
          totalRequests: 0,
          successCount: 0,
          errorCount: 0,
          errorRate: 0,
          avgResponseTime: 0,
        }),
      ],
    );

    this.logger.log(
      `Started canary deployment for '${featureKey}' at ${initialPercentage}%`,
    );

    const canary = await this.getCanary(featureKey);
    if (!canary) {
      throw new Error('Failed to create canary deployment');
    }
    return canary;
  }

  /**
   * Record a canary request (success or failure)
   */
  async recordRequest(
    featureKey: string,
    success: boolean,
    responseTime?: number,
  ): Promise<void> {
    const canary = await this.getCanary(featureKey);
    if (!canary || canary.status !== 'active') {
      return; // Not tracking
    }

    const metrics = canary.metrics;
    metrics.totalRequests++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }

    if (responseTime) {
      // Update rolling average
      metrics.avgResponseTime =
        (metrics.avgResponseTime * (metrics.totalRequests - 1) +
          responseTime) /
        metrics.totalRequests;
    }

    metrics.errorRate =
      (metrics.errorCount / metrics.totalRequests) * 100;

    // Update database
    await this.db.query(
      `UPDATE canary_deployments 
       SET metrics = $1, updated_at = $2
       WHERE feature_key = $3 AND status = 'active'`,
      [JSON.stringify(metrics), new Date(), featureKey],
    );

    // Check if we need to auto-rollback
    if (
      canary.rollbackThreshold &&
      metrics.errorRate > canary.rollbackThreshold &&
      metrics.totalRequests >= 100 // Only after sufficient sample size
    ) {
      this.logger.warn(
        `Error rate ${metrics.errorRate.toFixed(2)}% exceeds threshold ${canary.rollbackThreshold}% for '${featureKey}'`,
      );
      await this.rollback(featureKey, 'Auto-rollback: error rate exceeded threshold');
    }
  }

  /**
   * Increase canary percentage
   */
  async increasePercentage(
    featureKey: string,
    newPercentage: number,
  ): Promise<CanaryDeployment> {
    if (newPercentage < 0 || newPercentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    const existingCanary = await this.getCanary(featureKey);
    if (!existingCanary || existingCanary.status !== 'active') {
      throw new Error('No active canary deployment found');
    }

    // Update feature flag
    await this.featureFlags.updateFlag(featureKey, {
      percentage: newPercentage,
    });

    // Update canary record
    await this.db.query(
      `UPDATE canary_deployments 
       SET percentage = $1, updated_at = $2
       WHERE feature_key = $3 AND status = 'active'`,
      [newPercentage, new Date(), featureKey],
    );

    this.logger.log(
      `Increased canary percentage for '${featureKey}' to ${newPercentage}%`,
    );

    const updatedCanary = await this.getCanary(featureKey);
    if (!updatedCanary) {
      throw new Error('Canary deployment not found');
    }
    return updatedCanary;
  }

  /**
   * Rollback a canary deployment
   */
  async rollback(featureKey: string, reason?: string): Promise<void> {
    const canary = await this.getCanary(featureKey);
    if (!canary) {
      throw new Error('No canary deployment found');
    }

    // Disable feature flag
    await this.featureFlags.updateFlag(featureKey, {
      enabled: false,
      status: 'paused' as any,
    });

    // Update canary status
    await this.db.query(
      `UPDATE canary_deployments 
       SET status = 'rolled_back', end_time = $1, updated_at = $2
       WHERE feature_key = $3 AND status = 'active'`,
      [new Date(), new Date(), featureKey],
    );

    this.logger.warn(
      `Rolled back canary deployment for '${featureKey}'. Reason: ${reason || 'Manual rollback'}`,
    );
  }

  /**
   * Complete canary (100% rollout)
   */
  async complete(featureKey: string): Promise<void> {
    const canary = await this.getCanary(featureKey);
    if (!canary) {
      throw new Error('No canary deployment found');
    }

    // Set to 100%
    await this.featureFlags.updateFlag(featureKey, {
      percentage: 100,
    });

    // Mark as completed
    await this.db.query(
      `UPDATE canary_deployments 
       SET status = 'completed', percentage = 100, end_time = $1, updated_at = $2
       WHERE feature_key = $3 AND status = 'active'`,
      [new Date(), new Date(), featureKey],
    );

    this.logger.log(`Completed canary deployment for '${featureKey}'`);
  }

  /**
   * Get canary deployment status
   */
  async getCanary(featureKey: string): Promise<CanaryDeployment | null> {
    const result = await this.db.query<CanaryDeployment>(
      `SELECT 
        id, feature_key as "featureKey", version, percentage,
        start_time as "startTime", end_time as "endTime", status,
        rollback_threshold as "rollbackThreshold", created_by as "createdBy",
        metrics
      FROM canary_deployments 
      WHERE feature_key = $1 AND status IN ('active', 'paused')
      ORDER BY start_time DESC
      LIMIT 1`,
      [featureKey],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
    };
  }

  /**
   * List all active canary deployments
   */
  async listActiveCanaries(): Promise<CanaryDeployment[]> {
    const result = await this.db.query<CanaryDeployment>(
      `SELECT 
        id, feature_key as "featureKey", version, percentage,
        start_time as "startTime", end_time as "endTime", status,
        rollback_threshold as "rollbackThreshold", created_by as "createdBy",
        metrics
      FROM canary_deployments 
      WHERE status IN ('active', 'paused')
      ORDER BY start_time DESC`,
    );

    return result.rows.map((row) => ({
      ...row,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
    }));
  }
}

