/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../cache/redis.service';
import { v4 as uuidv4 } from 'uuid';

export enum FeatureFlagType {
  BOOLEAN = 'boolean',
  PERCENTAGE = 'percentage',
  USER_TARGETING = 'user_targeting',
  IP_TARGETING = 'ip_targeting',
}

export enum FeatureFlagStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: FeatureFlagType;
  status: FeatureFlagStatus;
  enabled: boolean;
  percentage?: number; // 0-100 for percentage rollout
  targetUsers?: string[]; // User IDs for user targeting
  targetIps?: string[]; // IP addresses for IP targeting
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeatureFlagDto {
  key: string;
  name: string;
  description?: string;
  type: FeatureFlagType;
  enabled?: boolean;
  percentage?: number;
  targetUsers?: string[];
  targetIps?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface UpdateFeatureFlagDto {
  name?: string;
  description?: string;
  type?: FeatureFlagType;
  status?: FeatureFlagStatus;
  enabled?: boolean;
  percentage?: number;
  targetUsers?: string[];
  targetIps?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly cacheTtl = 300; // 5 minutes

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if a feature flag is enabled for a given context
   */
  async isEnabled(
    flagKey: string,
    context?: {
      userId?: string;
      ip?: string;
      [key: string]: any;
    },
  ): Promise<boolean> {
    try {
      const flag = await this.getFlag(flagKey);

      if (!flag) {
        this.logger.warn(`Feature flag '${flagKey}' not found, returning false`);
        return false;
      }

      // Check status
      if (flag.status !== FeatureFlagStatus.ACTIVE) {
        return false;
      }

      // If globally disabled, return false
      if (!flag.enabled) {
        return false;
      }

      // Boolean flag - simple on/off
      if (flag.type === FeatureFlagType.BOOLEAN) {
        return flag.enabled;
      }

      // Percentage rollout
      if (flag.type === FeatureFlagType.PERCENTAGE) {
        if (!flag.percentage) {
          return false;
        }
        // Use consistent hashing based on userId or IP
        const hashKey = context?.userId || context?.ip || 'default';
        const hash = this.hashString(hashKey);
        const percentage = hash % 100;
        return percentage < flag.percentage;
      }

      // User targeting
      if (flag.type === FeatureFlagType.USER_TARGETING) {
        if (!context?.userId) {
          return false;
        }
        return flag.targetUsers?.includes(context.userId) || false;
      }

      // IP targeting
      if (flag.type === FeatureFlagType.IP_TARGETING) {
        if (!context?.ip) {
          return false;
        }
        return flag.targetIps?.includes(context.ip) || false;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking feature flag '${flagKey}':`, error);
      // Fail closed - return false on error
      return false;
    }
  }

  /**
   * Get feature flag by key
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check Redis cache first
    const cacheKey = `feature_flag:${key}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as FeatureFlag;
      }
    } catch (error) {
      this.logger.warn(`Failed to get flag from cache: ${error.message}`);
    }

    // Query database
    const result = await this.db.query<FeatureFlag>(
      `SELECT 
        id, key, name, description, type, status, enabled,
        percentage, target_users as "targetUsers", target_ips as "targetIps",
        metadata, created_by as "createdBy",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM feature_flags 
      WHERE key = $1 AND status != $2
      LIMIT 1`,
      [key, FeatureFlagStatus.ARCHIVED],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const flag = result.rows[0];

    // Cache the result
    try {
      await this.redis.set(cacheKey, JSON.stringify(flag), this.cacheTtl);
    } catch (error) {
      this.logger.warn(`Failed to cache flag: ${error.message}`);
    }

    return flag;
  }

  /**
   * Create a new feature flag
   */
  async createFlag(dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    // Validate
    if (dto.type === FeatureFlagType.PERCENTAGE) {
      if (!dto.percentage || dto.percentage < 0 || dto.percentage > 100) {
        throw new Error('Percentage must be between 0 and 100');
      }
    }

    const id = uuidv4();
    const now = new Date();

    const result = await this.db.query<FeatureFlag>(
      `INSERT INTO feature_flags (
        id, key, name, description, type, status, enabled,
        percentage, target_users, target_ips, metadata, created_by,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id, key, name, description, type, status, enabled,
        percentage, target_users as "targetUsers", target_ips as "targetIps",
        metadata, created_by as "createdBy",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        id,
        dto.key,
        dto.name,
        dto.description || null,
        dto.type,
        FeatureFlagStatus.DRAFT,
        dto.enabled ?? false,
        dto.percentage || null,
        dto.targetUsers ? JSON.stringify(dto.targetUsers) : null,
        dto.targetIps ? JSON.stringify(dto.targetIps) : null,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        dto.createdBy || null,
        now,
        now,
      ],
    );

    const flag = result.rows[0];

    // Invalidate cache
    await this.invalidateCache(dto.key);

    this.logger.log(`Created feature flag: ${dto.key}`);
    return flag;
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    key: string,
    dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }
    if (dto.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(dto.enabled);
    }
    if (dto.percentage !== undefined) {
      updates.push(`percentage = $${paramIndex++}`);
      values.push(dto.percentage);
    }
    if (dto.targetUsers !== undefined) {
      updates.push(`target_users = $${paramIndex++}`);
      values.push(JSON.stringify(dto.targetUsers));
    }
    if (dto.targetIps !== undefined) {
      updates.push(`target_ips = $${paramIndex++}`);
      values.push(JSON.stringify(dto.targetIps));
    }
    if (dto.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(dto.metadata));
    }

    if (updates.length === 0) {
      return (await this.getFlag(key))!;
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(key);

    const result = await this.db.query<FeatureFlag>(
      `UPDATE feature_flags 
       SET ${updates.join(', ')}
       WHERE key = $${paramIndex}
       RETURNING 
         id, key, name, description, type, status, enabled,
         percentage, target_users as "targetUsers", target_ips as "targetIps",
         metadata, created_by as "createdBy",
         created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(`Feature flag '${key}' not found`);
    }

    const flag = result.rows[0];

    // Invalidate cache
    await this.invalidateCache(key);

    this.logger.log(`Updated feature flag: ${key}`);
    return flag;
  }

  /**
   * List all feature flags
   */
  async listFlags(status?: FeatureFlagStatus): Promise<FeatureFlag[]> {
    let query = `SELECT 
      id, key, name, description, type, status, enabled,
      percentage, target_users as "targetUsers", target_ips as "targetIps",
      metadata, created_by as "createdBy",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM feature_flags`;

    const params: any[] = [];

    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    } else {
      query += ` WHERE status != $1`;
      params.push(FeatureFlagStatus.ARCHIVED);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query<FeatureFlag>(query, params);
    return result.rows;
  }

  /**
   * Delete/Archive a feature flag
   */
  async deleteFlag(key: string): Promise<void> {
    await this.db.query(
      `UPDATE feature_flags 
       SET status = $1, updated_at = $2
       WHERE key = $3`,
      [FeatureFlagStatus.ARCHIVED, new Date(), key],
    );

    await this.invalidateCache(key);
    this.logger.log(`Archived feature flag: ${key}`);
  }

  /**
   * Invalidate cache for a flag
   */
  private async invalidateCache(key: string): Promise<void> {
    try {
      await this.redis.del(`feature_flag:${key}`);
      // Also invalidate all flags cache if it exists
      await this.redis.del('feature_flags:all');
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache: ${error.message}`);
    }
  }

  /**
   * Hash string for consistent percentage rollout
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

