/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../cache/redis.service';

export enum ChaosType {
  LATENCY = 'latency',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  DATABASE_FAILURE = 'database_failure',
  REDIS_FAILURE = 'redis_failure',
  RANDOM_FAILURE = 'random_failure',
}

export interface ChaosRule {
  id: string;
  name: string;
  type: ChaosType;
  enabled: boolean;
  probability: number; // 0-100, percentage chance of triggering
  target?: string; // Endpoint pattern, service name, etc.
  config: {
    latencyMs?: number;
    errorCode?: number;
    errorMessage?: string;
    timeoutMs?: number;
  };
  metadata?: Record<string, any>;
}

@Injectable()
export class ChaosTestingService {
  private readonly logger = new Logger(ChaosTestingService.name);
  private readonly enabled: boolean;
  private rules: Map<string, ChaosRule> = new Map();

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Only enable in non-production environments
    this.enabled =
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      this.configService.get<boolean>('CHAOS_TESTING_ENABLED') === true;

    if (this.enabled) {
      this.logger.warn('⚠️  Chaos testing is ENABLED. This should only be used in development/staging!');
      this.loadRules();
    }
  }

  /**
   * Check if chaos should be injected for a given context
   */
  async shouldInjectChaos(
    context: {
      endpoint?: string;
      service?: string;
      userId?: string;
      [key: string]: any;
    },
  ): Promise<ChaosRule | null> {
    if (!this.enabled) {
      return null;
    }

    // Check each rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check if rule applies to this context
      if (rule.target) {
        if (context.endpoint && !context.endpoint.includes(rule.target)) {
          continue;
        }
        if (context.service && context.service !== rule.target) {
          continue;
        }
      }

      // Check probability
      const random = Math.random() * 100;
      if (random < rule.probability) {
        this.logger.warn(`🔥 Chaos injected: ${rule.name} (${rule.type})`);
        return rule;
      }
    }

    return null;
  }

  /**
   * Inject latency
   */
  async injectLatency(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Inject error
   */
  injectError(errorCode: number, errorMessage: string): never {
    const error: any = new Error(errorMessage);
    error.statusCode = errorCode;
    throw error;
  }

  /**
   * Inject database failure simulation
   */
  async simulateDatabaseFailure(): Promise<never> {
    // In a real implementation, you might temporarily disable database connections
    // For now, we'll just throw an error
    throw new Error('Simulated database failure');
  }

  /**
   * Inject Redis failure simulation
   */
  async simulateRedisFailure(): Promise<never> {
    throw new Error('Simulated Redis failure');
  }

  /**
   * Add a chaos rule
   */
  async addRule(rule: Omit<ChaosRule, 'id'>): Promise<ChaosRule> {
    const id = `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: ChaosRule = { ...rule, id };

    // Store in database
    await this.db.query(
      `INSERT INTO chaos_rules (
        id, name, type, enabled, probability, target, config, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        rule.name,
        rule.type,
        rule.enabled,
        rule.probability,
        rule.target || null,
        JSON.stringify(rule.config),
        rule.metadata ? JSON.stringify(rule.metadata) : null,
      ],
    );

    this.rules.set(id, fullRule);
    this.logger.log(`Added chaos rule: ${rule.name}`);

    return fullRule;
  }

  /**
   * Remove a chaos rule
   */
  async removeRule(id: string): Promise<void> {
    await this.db.query(`DELETE FROM chaos_rules WHERE id = $1`, [id]);
    this.rules.delete(id);
    this.logger.log(`Removed chaos rule: ${id}`);
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE chaos_rules SET enabled = $1 WHERE id = $2`,
      [enabled, id],
    );

    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * List all chaos rules
   */
  async listRules(): Promise<ChaosRule[]> {
    return Array.from(this.rules.values());
  }

  /**
   * Load rules from database
   */
  private async loadRules(): Promise<void> {
    try {
      const result = await this.db.query<ChaosRule>(
        `SELECT 
          id, name, type, enabled, probability, target,
          config, metadata
        FROM chaos_rules
        WHERE enabled = true`,
      );

      for (const row of result.rows) {
        this.rules.set(row.id, {
          ...row,
          config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        });
      }

      this.logger.log(`Loaded ${this.rules.size} chaos rules`);
    } catch (error) {
      this.logger.warn(`Failed to load chaos rules: ${error.message}`);
    }
  }
}

