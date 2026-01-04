import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * RLS Validator Service
 * 
 * Validates that RLS context is properly set and detects potential
 * RLS blocking issues. This service helps prevent silent failures
 * where queries return 0 rows due to missing RLS context.
 */
@Injectable()
export class RlsValidatorService {
  private readonly logger = new Logger(RlsValidatorService.name);
  private readonly rlsProtectedTables = [
    'chamas',
    'chama_members',
    'chama_invites',
    'contributions',
    'contribution_cycles',
    'payouts',
    'transactions',
    'entries',
    'accounts',
    'proposals',
    'votes',
    'proposal_discussions',
  ];

  constructor(
    @Inject(forwardRef(() => DatabaseService))
    private readonly db: DatabaseService,
  ) {}

  /**
   * Check if a query might be accessing RLS-protected tables
   */
  isRlsProtectedQuery(query: string): boolean {
    const upperQuery = query.toUpperCase();
    return this.rlsProtectedTables.some(
      (table) => upperQuery.includes(`FROM ${table.toUpperCase()}`) ||
                 upperQuery.includes(`JOIN ${table.toUpperCase()}`) ||
                 upperQuery.includes(`UPDATE ${table.toUpperCase()}`) ||
                 upperQuery.includes(`DELETE FROM ${table.toUpperCase()}`),
    );
  }

  /**
   * Validate that RLS context is set before executing a query
   * Returns true if context is set, false otherwise
   */
  async validateContext(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 
          current_setting('app.current_user_id', true) as user_id,
          current_setting('app.bypass_rls', true) as bypass_rls
        `,
      );

      const userId = result.rows[0]?.user_id;
      const bypassRls = result.rows[0]?.bypass_rls;

      // Context is valid if either user_id is set OR bypass_rls is 'true'
      const isValid = (userId && userId !== '') || bypassRls === 'true';

      if (!isValid) {
        this.logger.warn(
          '⚠️  RLS context not set! Queries to RLS-protected tables may return 0 rows.',
        );
      }

      return isValid;
    } catch (error) {
      // If we can't check context, assume it's not set (fail-safe)
      this.logger.error('Failed to validate RLS context', error);
      return false;
    }
  }

  /**
   * Warn if a query to RLS-protected table returns 0 rows
   * This helps detect silent RLS blocking issues
   */
  async warnIfEmptyResult(
    query: string,
    rowCount: number,
    expectedMinRows?: number,
  ): Promise<void> {
    if (!this.isRlsProtectedQuery(query)) {
      return; // Not an RLS-protected query, no warning needed
    }

    if (rowCount === 0) {
      const contextValid = await this.validateContext();
      if (!contextValid) {
        this.logger.error(
          `🚨 POTENTIAL RLS BLOCKING: Query returned 0 rows and RLS context is not set!\n` +
            `Query: ${query.substring(0, 200)}...\n` +
            `This may indicate that RLS is blocking the query. Ensure context is set before querying.`,
        );
      } else if (expectedMinRows && expectedMinRows > 0) {
        this.logger.warn(
          `⚠️  Query returned 0 rows but expected at least ${expectedMinRows}.\n` +
            `Query: ${query.substring(0, 200)}...\n` +
            `This may be expected, but verify RLS context is correct.`,
        );
      }
    }
  }
}

