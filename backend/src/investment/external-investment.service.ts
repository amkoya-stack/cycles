/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';
import axios from 'axios';

export interface CreateExternalPartnerDto {
  name: string;
  providerType: 'bank' | 'investment_platform' | 'asset_manager' | 'central_bank' | 'other';
  description?: string;
  apiBaseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  authType?: 'api_key' | 'oauth2' | 'basic_auth' | 'bearer_token';
  authConfig?: Record<string, any>;
  rateLimitPerMinute?: number;
  metadata?: Record<string, any>;
}

export interface UpdateNAVDto {
  productId: string;
  navValue: number;
  navDate: Date;
  totalUnits?: number;
  totalAssets?: number;
  updateSource?: 'api' | 'manual' | 'reconciliation';
  externalReference?: string;
  rawData?: Record<string, any>;
}

export interface ReconciliationResult {
  matched: boolean;
  discrepancies: any[];
  notes: string;
}

@Injectable()
export class ExternalInvestmentService {
  private readonly logger = new Logger(ExternalInvestmentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================================
  // EXTERNAL PARTNER MANAGEMENT
  // ============================================================================

  /**
   * Create external investment partner
   */
  async createPartner(dto: CreateExternalPartnerDto): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `INSERT INTO external_investment_partners 
         (name, provider_type, description, api_base_url, api_key, api_secret,
          auth_type, auth_config, rate_limit_per_minute, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          dto.name,
          dto.providerType,
          dto.description || null,
          dto.apiBaseUrl,
          dto.apiKey || null,
          dto.apiSecret || null,
          dto.authType || 'api_key',
          JSON.stringify(dto.authConfig || {}),
          dto.rateLimitPerMinute || 60,
          JSON.stringify(dto.metadata || {}),
        ],
      );

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get all external partners
   */
  async getPartners(filters?: {
    providerType?: string;
    isActive?: boolean;
  }): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = 'SELECT * FROM external_investment_partners WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.providerType) {
        query += ` AND provider_type = $${paramIndex++}`;
        params.push(filters.providerType);
      }

      if (filters?.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(filters.isActive);
      }

      query += ' ORDER BY name ASC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get partner by ID
   */
  async getPartnerById(partnerId: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        'SELECT * FROM external_investment_partners WHERE id = $1',
        [partnerId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException('External partner not found');
      }

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Test partner API connection
   */
  async testPartnerConnection(partnerId: string): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
  }> {
    const partner = await this.getPartnerById(partnerId);

    if (!partner.is_active) {
      throw new BadRequestException('Partner is not active');
    }

    try {
      const startTime = Date.now();
      const response = await this.makeApiRequest(partner, 'GET', '/health', {});
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: 'Connection successful',
        responseTime,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection failed',
      };
    }
  }

  // ============================================================================
  // NAV UPDATES
  // ============================================================================

  /**
   * Update NAV for a product
   */
  async updateNAV(dto: UpdateNAVDto, partnerId?: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      // Check if NAV already exists for this date
      const existingResult = await this.db.query(
        'SELECT id FROM nav_updates WHERE product_id = $1 AND nav_date = $2',
        [dto.productId, dto.navDate],
      );

      let result;
      if (existingResult.rowCount > 0) {
        // Update existing NAV
        result = await this.db.query(
          `UPDATE nav_updates 
           SET nav_value = $1, total_units = $2, total_assets = $3,
               update_source = $4, external_reference = $5, raw_data = $6,
               updated_at = NOW()
           WHERE product_id = $7 AND nav_date = $8
           RETURNING *`,
          [
            dto.navValue,
            dto.totalUnits || null,
            dto.totalAssets || null,
            dto.updateSource || 'api',
            dto.externalReference || null,
            JSON.stringify(dto.rawData || {}),
            dto.productId,
            dto.navDate,
          ],
        );
      } else {
        // Insert new NAV
        result = await this.db.query(
          `INSERT INTO nav_updates 
           (product_id, partner_id, nav_value, nav_date, total_units, total_assets,
            update_source, external_reference, raw_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            dto.productId,
            partnerId || null,
            dto.navValue,
            dto.navDate,
            dto.totalUnits || null,
            dto.totalAssets || null,
            dto.updateSource || 'api',
            dto.externalReference || null,
            JSON.stringify(dto.rawData || {}),
          ],
        );
      }

      // Update product with latest NAV if it's a money market fund
      await this.db.query(
        `UPDATE investment_products 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'),
           '{latest_nav}',
           jsonb_build_object('value', $1, 'date', $2)
         ),
         updated_at = NOW()
         WHERE id = $3 AND product_type = 'money_market_fund'`,
        [dto.navValue, dto.navDate, dto.productId],
      );

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Fetch NAV from external partner API
   */
  async fetchNAVFromPartner(
    productId: string,
    partnerId: string,
  ): Promise<any> {
    const partner = await this.getPartnerById(partnerId);
    const productResult = await this.db.query(
      'SELECT * FROM investment_products WHERE id = $1',
      [productId],
    );

    if (productResult.rowCount === 0) {
      throw new NotFoundException('Investment product not found');
    }

    const product = mapQueryRow(productResult.rows[0]);

    if (!product.external_product_id) {
      throw new BadRequestException(
        'Product does not have an external product ID',
      );
    }

    try {
      // Make API request to fetch NAV
      // This is a generic implementation - actual endpoints will vary by partner
      const response = await this.makeApiRequest(
        partner,
        'GET',
        `/products/${product.external_product_id}/nav`,
        {},
      );

      // Parse response (structure will vary by partner)
      const navValue = response.data?.nav || response.data?.netAssetValue;
      const navDate = response.data?.date || new Date().toISOString().split('T')[0];

      if (!navValue) {
        throw new BadRequestException('NAV value not found in API response');
      }

      // Update NAV in database
      return await this.updateNAV(
        {
          productId,
          navValue: parseFloat(navValue),
          navDate: new Date(navDate),
          totalUnits: response.data?.totalUnits,
          totalAssets: response.data?.totalAssets,
          updateSource: 'api',
          externalReference: response.data?.reference,
          rawData: response.data,
        },
        partnerId,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch NAV from partner ${partnerId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get NAV history for a product
   */
  async getNAVHistory(
    productId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = `
        SELECT n.*, p.name as partner_name
        FROM nav_updates n
        LEFT JOIN external_investment_partners p ON n.partner_id = p.id
        WHERE n.product_id = $1
      `;
      const params: any[] = [productId];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND n.nav_date >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND n.nav_date <= $${paramIndex++}`;
        params.push(endDate);
      }

      query += ' ORDER BY n.nav_date DESC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  // ============================================================================
  // STATEMENT RECONCILIATION
  // ============================================================================

  /**
   * Reconcile external statement with internal investment records
   */
  async reconcileStatement(
    statementId: string,
    reconciledBy: string,
  ): Promise<ReconciliationResult> {
    await this.db.setSystemContext();

    try {
      const statementResult = await this.db.query(
        `SELECT s.*, i.*, p.name as product_name
         FROM external_investment_statements s
         JOIN investments i ON s.investment_id = i.id
         JOIN investment_products p ON i.product_id = p.id
         WHERE s.id = $1`,
        [statementId],
      );

      if (statementResult.rowCount === 0) {
        throw new NotFoundException('Statement not found');
      }

      const statement = mapQueryRow(statementResult.rows[0]);
      const investment = statement;

      const discrepancies: any[] = [];
      let matched = true;

      // Compare closing balance
      const expectedBalance =
        parseFloat(investment.amount) +
        parseFloat(investment.interest_earned || 0);
      const actualBalance = parseFloat(statement.closing_balance);

      if (Math.abs(expectedBalance - actualBalance) > 0.01) {
        matched = false;
        discrepancies.push({
          type: 'balance_mismatch',
          expectedValue: expectedBalance,
          actualValue: actualBalance,
          difference: actualBalance - expectedBalance,
          description: `Closing balance mismatch. Expected: ${expectedBalance}, Actual: ${actualBalance}`,
        });
      }

      // Compare interest earned
      const expectedInterest = parseFloat(investment.interest_earned || 0);
      const actualInterest = parseFloat(statement.interest_earned || 0);

      if (Math.abs(expectedInterest - actualInterest) > 0.01) {
        matched = false;
        discrepancies.push({
          type: 'interest_discrepancy',
          expectedValue: expectedInterest,
          actualValue: actualInterest,
          difference: actualInterest - expectedInterest,
          description: `Interest earned mismatch. Expected: ${expectedInterest}, Actual: ${actualInterest}`,
        });
      }

      // Record discrepancies
      for (const discrepancy of discrepancies) {
        await this.db.query(
          `INSERT INTO statement_reconciliation_discrepancies
           (statement_id, investment_id, discrepancy_type, expected_value, actual_value,
            difference, description, affected_period_start, affected_period_end)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            statementId,
            investment.investment_id,
            discrepancy.type,
            discrepancy.expectedValue,
            discrepancy.actualValue,
            discrepancy.difference,
            discrepancy.description,
            statement.statement_period_start,
            statement.statement_period_end,
          ],
        );
      }

      // Update statement reconciliation status
      const reconciliationStatus = matched ? 'matched' : 'discrepancy';
      await this.db.query(
        `UPDATE external_investment_statements
         SET reconciliation_status = $1,
             reconciliation_notes = $2,
             reconciled_by = $3,
             reconciled_at = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [
          reconciliationStatus,
          matched
            ? 'Statement matched successfully'
            : `Found ${discrepancies.length} discrepancy(ies)`,
          reconciledBy,
          statementId,
        ],
      );

      return {
        matched,
        discrepancies,
        notes: matched
          ? 'Statement reconciled successfully'
          : `Found ${discrepancies.length} discrepancy(ies) requiring attention`,
      };
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get reconciliation discrepancies
   */
  async getDiscrepancies(filters?: {
    statementId?: string;
    investmentId?: string;
    status?: string;
  }): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = `
        SELECT d.*, s.statement_period_start, s.statement_period_end,
               i.amount as investment_amount, p.name as product_name
        FROM statement_reconciliation_discrepancies d
        JOIN external_investment_statements s ON d.statement_id = s.id
        JOIN investments i ON d.investment_id = i.id
        JOIN investment_products p ON i.product_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.statementId) {
        query += ` AND d.statement_id = $${paramIndex++}`;
        params.push(filters.statementId);
      }

      if (filters?.investmentId) {
        query += ` AND d.investment_id = $${paramIndex++}`;
        params.push(filters.investmentId);
      }

      if (filters?.status) {
        query += ` AND d.status = $${paramIndex++}`;
        params.push(filters.status);
      }

      query += ' ORDER BY d.created_at DESC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Make API request to external partner
   */
  private async makeApiRequest(
    partner: any,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
  ): Promise<any> {
    // Check rate limiting
    if (partner.last_api_call_at) {
      const lastCall = new Date(partner.last_api_call_at);
      const now = new Date();
      const secondsSinceLastCall =
        (now.getTime() - lastCall.getTime()) / 1000;

      if (secondsSinceLastCall < 60 / partner.rate_limit_per_minute) {
        throw new BadRequestException('Rate limit exceeded. Please wait.');
      }
    }

    const url = `${partner.api_base_url}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication based on auth_type
    switch (partner.auth_type) {
      case 'api_key':
        if (partner.api_key) {
          headers['X-API-Key'] = partner.api_key;
        }
        break;
      case 'bearer_token':
        const authConfig = partner.auth_config || {};
        if (authConfig.token) {
          headers['Authorization'] = `Bearer ${authConfig.token}`;
        }
        break;
      case 'basic_auth':
        if (partner.api_key && partner.api_secret) {
          const credentials = Buffer.from(
            `${partner.api_key}:${partner.api_secret}`,
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'oauth2':
        // OAuth2 implementation would go here
        // For now, use bearer token from auth_config
        const oauthConfig = partner.auth_config || {};
        if (oauthConfig.access_token) {
          headers['Authorization'] = `Bearer ${oauthConfig.access_token}`;
        }
        break;
    }

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: 30000, // 30 second timeout
      });

      // Update last API call timestamp
      await this.db.query(
        'UPDATE external_investment_partners SET last_api_call_at = NOW() WHERE id = $1',
        [partner.id],
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `API request failed: ${error.message}`,
        error.response?.data,
      );
      throw new BadRequestException(
        `External API request failed: ${error.message}`,
      );
    }
  }
}

