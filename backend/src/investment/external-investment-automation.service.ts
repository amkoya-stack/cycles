import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { ExternalInvestmentService } from './external-investment.service';
import { mapQueryResult } from '../database/mapper.util';

@Injectable()
export class ExternalInvestmentAutomationService {
  private readonly logger = new Logger(
    ExternalInvestmentAutomationService.name,
  );

  constructor(
    private readonly db: DatabaseService,
    private readonly externalInvestment: ExternalInvestmentService,
  ) {}

  /**
   * Daily cron job - Update NAV for money market funds
   * Runs daily at 11 AM EAT
   */
  @Cron('0 11 * * *', {
    name: 'update-nav-values',
    timeZone: 'Africa/Nairobi',
  })
  async updateNAVValues() {
    this.logger.log('Starting NAV update process...');

    try {
      await this.db.setSystemContext();

      // Get all active money market funds with external partners
      const productsResult = await this.db.query(
        `SELECT p.*, ep.id as partner_id, ep.name as partner_name
         FROM investment_products p
         LEFT JOIN external_investment_partners ep ON p.external_provider = ep.name
         WHERE p.product_type = 'money_market_fund'
           AND p.is_active = true
           AND p.external_product_id IS NOT NULL
           AND (ep.is_active = true OR ep.id IS NULL)`,
      );

      const products = mapQueryResult(productsResult.rows);
      this.logger.log(`Found ${products.length} money market funds to update`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const product of products) {
        try {
          if (product.partner_id) {
            // Fetch NAV from external partner API
            await this.externalInvestment.fetchNAVFromPartner(
              product.id,
              product.partner_id,
            );
            updatedCount++;
            this.logger.log(
              `Updated NAV for product ${product.name} from partner ${product.partner_name}`,
            );
          } else if (product.nav_update_url) {
            // Fetch NAV from direct URL (if configured)
            await this.updateNAVFromURL(product);
            updatedCount++;
          } else {
            this.logger.warn(
              `Product ${product.name} has no partner or NAV URL configured`,
            );
          }
        } catch (error: any) {
          errorCount++;
          this.logger.error(
            `Failed to update NAV for product ${product.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `NAV update completed. Updated: ${updatedCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Error in NAV update process:', error);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Weekly cron job - Fetch and reconcile investment statements
   * Runs every Monday at 9 AM EAT
   */
  @Cron('0 9 * * 1', {
    name: 'fetch-investment-statements',
    timeZone: 'Africa/Nairobi',
  })
  async fetchInvestmentStatements() {
    this.logger.log('Starting investment statement fetching...');

    try {
      await this.db.setSystemContext();

      // Get all active investments with external partners
      const investmentsResult = await this.db.query(
        `SELECT i.*, p.external_product_id, p.external_provider,
                ep.id as partner_id, ep.name as partner_name
         FROM investments i
         JOIN investment_products p ON i.product_id = p.id
         LEFT JOIN external_investment_partners ep ON p.external_provider = ep.name
         WHERE i.status = 'active'
           AND i.external_investment_id IS NOT NULL
           AND ep.is_active = true`,
      );

      const investments = mapQueryResult(investmentsResult.rows);
      this.logger.log(
        `Found ${investments.length} investments with external partners`,
      );

      let fetchedCount = 0;
      let errorCount = 0;

      for (const investment of investments) {
        try {
          // Fetch statement from external partner
          // This is a placeholder - actual implementation depends on partner API
          await this.fetchStatementFromPartner(investment);
          fetchedCount++;
        } catch (error: any) {
          errorCount++;
          this.logger.error(
            `Failed to fetch statement for investment ${investment.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Statement fetching completed. Fetched: ${fetchedCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Error in statement fetching:', error);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Daily cron job - Auto-reconcile statements
   * Runs daily at 2 PM EAT
   */
  @Cron('0 14 * * *', {
    name: 'auto-reconcile-statements',
    timeZone: 'Africa/Nairobi',
  })
  async autoReconcileStatements() {
    this.logger.log('Starting automated statement reconciliation...');

    try {
      await this.db.setSystemContext();

      // Get pending statements
      const statementsResult = await this.db.query(
        `SELECT s.*, i.id as investment_id
         FROM external_investment_statements s
         JOIN investments i ON s.investment_id = i.id
         WHERE s.reconciliation_status = 'pending'
           AND s.statement_date <= CURRENT_DATE
         ORDER BY s.statement_date ASC
         LIMIT 50`,
      );

      const statements = mapQueryResult(statementsResult.rows);
      this.logger.log(`Found ${statements.length} statements to reconcile`);

      let reconciledCount = 0;
      let discrepancyCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        try {
          const result = await this.externalInvestment.reconcileStatement(
            statement.id,
            'system', // System user for automated reconciliation
          );

          if (result.matched) {
            reconciledCount++;
          } else {
            discrepancyCount++;
            this.logger.warn(
              `Statement ${statement.id} has ${result.discrepancies.length} discrepancy(ies)`,
            );
          }
        } catch (error: any) {
          errorCount++;
          this.logger.error(
            `Failed to reconcile statement ${statement.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Reconciliation completed. Matched: ${reconciledCount}, Discrepancies: ${discrepancyCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Error in statement reconciliation:', error);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Update NAV from direct URL
   */
  private async updateNAVFromURL(product: any): Promise<void> {
    // This would fetch NAV from a public URL (e.g., Central Bank of Kenya)
    // Implementation depends on the data source format
    this.logger.log(
      `Updating NAV from URL for product ${product.name} - URL: ${product.nav_update_url}`,
    );
    // Placeholder - actual implementation would fetch and parse the URL
  }

  /**
   * Fetch statement from external partner
   */
  private async fetchStatementFromPartner(investment: any): Promise<void> {
    // This is a placeholder - actual implementation depends on partner API structure
    this.logger.log(
      `Fetching statement for investment ${investment.id} from partner ${investment.partner_name}`,
    );

    // In a real implementation, you would:
    // 1. Call partner API to get statement
    // 2. Parse statement data
    // 3. Store in external_investment_statements table
    // 4. Trigger reconciliation

    // Example structure:
    // const statement = await this.externalInvestment.makeApiRequest(...);
    // await this.db.query('INSERT INTO external_investment_statements ...');
  }
}

