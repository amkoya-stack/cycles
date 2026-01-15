/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';
import { RlsValidatorService } from './rls-validator.service';

// Railway deployment fix - force rebuild
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => RlsValidatorService))
    private rlsValidator?: RlsValidatorService,
  ) {}

  async onModuleInit() {
    this.pool = new Pool({
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      user: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_DATABASE'),
      max: this.configService.get('DB_MAX_CONNECTIONS') || 20,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  // Execute a query
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();

    // Validate RLS context if validator is available (development/staging only)
    if (this.rlsValidator && process.env.NODE_ENV !== 'production') {
      const isRlsProtected = this.rlsValidator.isRlsProtectedQuery(text);
      if (isRlsProtected) {
        const contextValid = await this.rlsValidator.validateContext();
        if (!contextValid) {
          this.logger.warn(
            `⚠️  Querying RLS-protected table without context set: ${text.substring(0, 100)}...`,
          );
        }
      }
    }

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      // Warn if RLS-protected query returns 0 rows (potential blocking)
      if (this.rlsValidator && process.env.NODE_ENV !== 'production') {
        await this.rlsValidator.warnIfEmptyResult(text, result.rowCount ?? 0);
      }

      this.logger.debug(
        `Executed query: ${duration}ms, ${result.rowCount ?? 0} rows`,
      );
      return result;
    } catch (error) {
      this.logger.error('Query error:', {
        text: text.substring(0, 200),
        error,
      });
      throw error;
    }
  }

  // Get a client for transactions
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // Transaction helper
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // RLS Context Helpers
  async setUserContext(userId: string): Promise<void> {
    await this.query('SELECT set_user_context($1)', [userId]);
    this.logger.debug(`RLS context set for user: ${userId}`);
  }

  async setSystemContext(): Promise<void> {
    await this.query('SELECT set_system_context()');
    this.logger.debug('RLS system context set (bypasses RLS)');
  }

  async clearContext(): Promise<void> {
    await this.query('SELECT clear_context()');
    this.logger.debug('RLS context cleared');
  }

  /**
   * Execute a query with automatic system context (for public/admin operations)
   * Automatically sets and clears system context around the query
   */
  async queryAsSystem<T = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    await this.setSystemContext();
    try {
      return await this.query<T>(text, params);
    } finally {
      await this.clearContext();
    }
  }

  /**
   * Execute a query with automatic user context
   * Automatically sets and clears user context around the query
   */
  async queryAsUser<T = any>(
    userId: string,
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    await this.setUserContext(userId);
    try {
      return await this.query<T>(text, params);
    } finally {
      await this.clearContext();
    }
  }

  // Transaction with user context
  async transactionWithUser<T>(
    userId: string,
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_user_context($1)', [userId]);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.query('SELECT clear_context()');
      client.release();
    }
  }

  // Transaction with system context (bypasses RLS)
  async transactionAsSystem<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_system_context()');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.query('SELECT clear_context()');
      client.release();
    }
  }
}
