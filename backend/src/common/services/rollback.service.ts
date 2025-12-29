/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FeatureFlagsService } from './feature-flags.service';
import { CanaryDeploymentService } from './canary-deployment.service';
import { v4 as uuidv4 } from 'uuid';

export enum RollbackType {
  FEATURE_FLAG = 'feature_flag',
  CANARY_DEPLOYMENT = 'canary_deployment',
  DATABASE_MIGRATION = 'database_migration',
  CODE_DEPLOYMENT = 'code_deployment',
}

export interface RollbackRecord {
  id: string;
  type: RollbackType;
  targetId: string; // Feature key, migration version, etc.
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly canary: CanaryDeploymentService,
  ) {}

  /**
   * Instant rollback - disable feature flag immediately
   */
  async rollbackFeatureFlag(
    featureKey: string,
    reason: string,
    createdBy?: string,
  ): Promise<RollbackRecord> {
    const id = uuidv4();
    const now = new Date();

    // Create rollback record
    await this.db.query(
      `INSERT INTO rollbacks (
        id, type, target_id, reason, status, started_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        RollbackType.FEATURE_FLAG,
        featureKey,
        reason,
        'in_progress',
        now,
        createdBy || null,
      ],
    );

    try {
      // Disable feature flag immediately
      await this.featureFlags.updateFlag(featureKey, {
        enabled: false,
        status: 'paused' as any,
      });

      // If there's an active canary, roll it back too
      const canary = await this.canary.getCanary(featureKey);
      if (canary && canary.status === 'active') {
        await this.canary.rollback(featureKey, reason);
      }

      // Mark rollback as completed
      await this.db.query(
        `UPDATE rollbacks 
         SET status = 'completed', completed_at = $1
         WHERE id = $2`,
        [new Date(), id],
      );

      this.logger.warn(`Rolled back feature flag '${featureKey}': ${reason}`);

      const rollback = await this.getRollback(id);
      if (!rollback) {
        throw new Error('Failed to retrieve rollback record');
      }
      return rollback;
    } catch (error: any) {
      // Mark as failed
      await this.db.query(
        `UPDATE rollbacks 
         SET status = 'failed', error = $1, completed_at = $2
         WHERE id = $3`,
        [error.message, new Date(), id],
      );

      this.logger.error(`Failed to rollback feature flag '${featureKey}':`, error);
      throw error;
    }
  }

  /**
   * Rollback canary deployment
   */
  async rollbackCanary(
    featureKey: string,
    reason: string,
    createdBy?: string,
  ): Promise<RollbackRecord> {
    const id = uuidv4();
    const now = new Date();

    await this.db.query(
      `INSERT INTO rollbacks (
        id, type, target_id, reason, status, started_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        RollbackType.CANARY_DEPLOYMENT,
        featureKey,
        reason,
        'in_progress',
        now,
        createdBy || null,
      ],
    );

    try {
      await this.canary.rollback(featureKey, reason);

      await this.db.query(
        `UPDATE rollbacks 
         SET status = 'completed', completed_at = $1
         WHERE id = $2`,
        [new Date(), id],
      );

      this.logger.warn(`Rolled back canary deployment '${featureKey}': ${reason}`);

      const rollback = await this.getRollback(id);
      if (!rollback) {
        throw new Error('Failed to retrieve rollback record');
      }
      return rollback;
    } catch (error: any) {
      await this.db.query(
        `UPDATE rollbacks 
         SET status = 'failed', error = $1, completed_at = $2
         WHERE id = $3`,
        [error.message, new Date(), id],
      );

      this.logger.error(`Failed to rollback canary '${featureKey}':`, error);
      throw error;
    }
  }

  /**
   * Get rollback record
   */
  async getRollback(id: string): Promise<RollbackRecord | null> {
    const result = await this.db.query<RollbackRecord>(
      `SELECT 
        id, type, target_id as "targetId", reason, status,
        started_at as "startedAt", completed_at as "completedAt",
        error, metadata, created_by as "createdBy"
      FROM rollbacks 
      WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }

  /**
   * List recent rollbacks
   */
  async listRollbacks(limit: number = 50): Promise<RollbackRecord[]> {
    const result = await this.db.query<RollbackRecord>(
      `SELECT 
        id, type, target_id as "targetId", reason, status,
        started_at as "startedAt", completed_at as "completedAt",
        error, metadata, created_by as "createdBy"
      FROM rollbacks 
      ORDER BY started_at DESC
      LIMIT $1`,
      [limit],
    );

    return result.rows.map((row) => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));
  }
}

