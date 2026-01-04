/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { GovernanceService, ProposalType, VotingType } from '../governance/governance.service';
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export enum InvestmentProductType {
  TREASURY_BILL_91 = 'treasury_bill_91',
  TREASURY_BILL_182 = 'treasury_bill_182',
  TREASURY_BILL_364 = 'treasury_bill_364',
  MONEY_MARKET_FUND = 'money_market_fund',
  GOVERNMENT_BOND = 'government_bond',
  FIXED_DEPOSIT = 'fixed_deposit',
  INVESTMENT_POOL = 'investment_pool',
}

export enum InvestmentStatus {
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  ACTIVE = 'active',
  MATURED = 'matured',
  CANCELLED = 'cancelled',
  LIQUIDATED = 'liquidated',
}

export enum DividendStatus {
  PENDING = 'pending',
  DISTRIBUTED = 'distributed',
  REINVESTED = 'reinvested',
}

export interface CreateInvestmentProductDto {
  productType: InvestmentProductType;
  name: string;
  description?: string;
  minimumInvestment: number;
  maximumInvestment?: number;
  interestRate: number;
  riskRating: number; // 1-5
  maturityDays: number;
  compoundingFrequency?: 'monthly' | 'quarterly' | 'annually' | 'at_maturity';
  isFeatured?: boolean;
  externalProductId?: string;
  externalProvider?: string;
  navUpdateUrl?: string;
  metadata?: Record<string, any>;
}

export interface CreateInvestmentDto {
  chamaId: string;
  productId: string;
  amount: number;
  requiresVote?: boolean;
  votingType?: VotingType;
  deadlineHours?: number;
  idempotencyKey?: string;
}

export interface CreateInvestmentPoolDto {
  productId: string;
  name: string;
  description?: string;
  targetAmount: number;
  minimumContribution: number;
  closingDate?: Date;
}

export interface ContributeToPoolDto {
  poolId: string;
  chamaId: string;
  amount: number;
  userId?: string; // Optional: if individual member contributing
}

export interface DistributeDividendDto {
  investmentId: string;
  amount: number;
  paymentDate?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  distributedBy?: string;
  distributeToWallet?: boolean;
  reinvest?: boolean;
  idempotencyKey?: string;
  externalReference?: string;
}

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly governance: GovernanceService,
    @InjectQueue('investment-executions')
    private readonly investmentQueue: Queue,
  ) {}

  // ============================================================================
  // INVESTMENT PRODUCTS
  // ============================================================================

  /**
   * Create a new investment product
   */
  async createProduct(dto: CreateInvestmentProductDto): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `INSERT INTO investment_products 
         (product_type, name, description, minimum_investment, maximum_investment, 
          interest_rate, risk_rating, maturity_days, compounding_frequency, is_featured,
          external_product_id, external_provider, nav_update_url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          dto.productType,
          dto.name,
          dto.description || null,
          dto.minimumInvestment,
          dto.maximumInvestment || null,
          dto.interestRate,
          dto.riskRating,
          dto.maturityDays,
          dto.compoundingFrequency || 'at_maturity',
          dto.isFeatured || false,
          dto.externalProductId || null,
          dto.externalProvider || null,
          dto.navUpdateUrl || null,
          JSON.stringify(dto.metadata || {}),
        ],
      );

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get all investment products
   */
  async getProducts(filters?: {
    productType?: InvestmentProductType;
    isActive?: boolean;
    isFeatured?: boolean;
    minInterestRate?: number;
    maxRiskRating?: number;
  }): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = 'SELECT * FROM investment_products WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.productType) {
        query += ` AND product_type = $${paramIndex++}`;
        params.push(filters.productType);
      }

      if (filters?.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(filters.isActive);
      }

      if (filters?.isFeatured !== undefined) {
        query += ` AND is_featured = $${paramIndex++}`;
        params.push(filters.isFeatured);
      }

      if (filters?.minInterestRate) {
        query += ` AND interest_rate >= $${paramIndex++}`;
        params.push(filters.minInterestRate);
      }

      if (filters?.maxRiskRating) {
        query += ` AND risk_rating <= $${paramIndex++}`;
        params.push(filters.maxRiskRating);
      }

      query += ' ORDER BY is_featured DESC, interest_rate DESC, created_at DESC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get investment product by ID
   */
  async getProductById(productId: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        'SELECT * FROM investment_products WHERE id = $1',
        [productId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException('Investment product not found');
      }

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Update investment product
   */
  async updateProduct(
    productId: string,
    updates: Partial<CreateInvestmentProductDto>,
  ): Promise<any> {
    await this.db.setSystemContext();

    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.minimumInvestment !== undefined) {
        fields.push(`minimum_investment = $${paramIndex++}`);
        values.push(updates.minimumInvestment);
      }
      if (updates.maximumInvestment !== undefined) {
        fields.push(`maximum_investment = $${paramIndex++}`);
        values.push(updates.maximumInvestment);
      }
      if (updates.interestRate !== undefined) {
        fields.push(`interest_rate = $${paramIndex++}`);
        values.push(updates.interestRate);
      }
      if (updates.riskRating !== undefined) {
        fields.push(`risk_rating = $${paramIndex++}`);
        values.push(updates.riskRating);
      }
      if (updates.maturityDays !== undefined) {
        fields.push(`maturity_days = $${paramIndex++}`);
        values.push(updates.maturityDays);
      }
      if (updates.isFeatured !== undefined) {
        fields.push(`is_featured = $${paramIndex++}`);
        values.push(updates.isFeatured);
      }

      if (fields.length === 0) {
        return this.getProductById(productId);
      }

      values.push(productId);
      const result = await this.db.query(
        `UPDATE investment_products 
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING *`,
        values,
      );

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  // ============================================================================
  // INVESTMENTS
  // ============================================================================

  /**
   * Create investment proposal
   */
  async createInvestment(
    dto: CreateInvestmentDto,
    createdBy: string,
  ): Promise<any> {
    const idempotencyKey = dto.idempotencyKey || uuidv4();
    
    this.logger.log(
      `[INVESTMENT_CREATE] Starting investment creation - ` +
      `chamaId: ${dto.chamaId}, productId: ${dto.productId}, ` +
      `amount: ${dto.amount}, createdBy: ${createdBy}, idempotencyKey: ${idempotencyKey}`,
    );

    await this.db.setSystemContext();

    try {
      // Get product details
      this.logger.debug(`[INVESTMENT_CREATE] Fetching product details - productId: ${dto.productId}`);
      const product = await this.getProductById(dto.productId);
      this.logger.debug(`[INVESTMENT_CREATE] Product fetched - name: ${product.name}, type: ${product.product_type}`);

      // Validate amount
      if (dto.amount < product.minimum_investment) {
        this.logger.warn(
          `[INVESTMENT_CREATE] Validation failed - amount too low - ` +
          `amount: ${dto.amount}, minimum: ${product.minimum_investment}, ` +
          `chamaId: ${dto.chamaId}, productId: ${dto.productId}`,
        );
        throw new BadRequestException(
          `Minimum investment is ${product.minimum_investment}`,
        );
      }

      if (product.maximum_investment && dto.amount > product.maximum_investment) {
        this.logger.warn(
          `[INVESTMENT_CREATE] Validation failed - amount too high - ` +
          `amount: ${dto.amount}, maximum: ${product.maximum_investment}, ` +
          `chamaId: ${dto.chamaId}, productId: ${dto.productId}`,
        );
        throw new BadRequestException(
          `Maximum investment is ${product.maximum_investment}`,
        );
      }

      this.logger.debug(`[INVESTMENT_CREATE] Amount validation passed - amount: ${dto.amount}`);

      // Calculate maturity date
      const maturityDate = new Date();
      maturityDate.setDate(maturityDate.getDate() + product.maturity_days);
      this.logger.debug(
        `[INVESTMENT_CREATE] Calculated maturity date - ` +
        `maturityDate: ${maturityDate.toISOString()}, maturityDays: ${product.maturity_days}`,
      );

      // Calculate expected return
      this.logger.debug(
        `[INVESTMENT_CREATE] Calculating expected return - ` +
        `amount: ${dto.amount}, rate: ${product.interest_rate}%, ` +
        `days: ${product.maturity_days}, compounding: ${product.compounding_frequency || 'at_maturity'}`,
      );
      const expectedReturnResult = await this.db.query(
        `SELECT calculate_expected_return($1, $2, $3, $4) as expected_return`,
        [
          dto.amount,
          product.interest_rate,
          product.maturity_days,
          product.compounding_frequency || 'at_maturity',
        ],
      );
      const expectedReturn = parseFloat(
        expectedReturnResult.rows[0].expected_return,
      );
      this.logger.debug(`[INVESTMENT_CREATE] Expected return calculated - expectedReturn: ${expectedReturn}`);

      let proposalId: string | null = null;

      // Create proposal if voting is required
      if (dto.requiresVote !== false) {
        this.logger.log(
          `[INVESTMENT_CREATE] Creating governance proposal - ` +
          `chamaId: ${dto.chamaId}, votingType: ${dto.votingType || 'simple_majority'}, ` +
          `deadlineHours: ${dto.deadlineHours || 72}`,
        );
        const proposal = await this.governance.createProposal({
          chamaId: dto.chamaId,
          createdBy: createdBy,
          proposalType: ProposalType.MAKE_INVESTMENT,
          title: `Invest KES ${dto.amount.toLocaleString()} in ${product.name}`,
          description: `Proposal to invest KES ${dto.amount.toLocaleString()} in ${product.name} with expected return of KES ${expectedReturn.toLocaleString()}`,
          metadata: {
            productId: dto.productId,
            amount: dto.amount,
            expectedReturn,
            maturityDate: maturityDate.toISOString(),
          },
          votingType: dto.votingType || VotingType.SIMPLE_MAJORITY,
          deadlineHours: dto.deadlineHours || 72,
        });
        proposalId = proposal.id;
        this.logger.log(`[INVESTMENT_CREATE] Governance proposal created - proposalId: ${proposalId}`);
      } else {
        this.logger.debug(`[INVESTMENT_CREATE] Skipping governance proposal - requiresVote: false`);
      }

      // Check idempotency for investment creation
      if (dto.idempotencyKey) {
        this.logger.debug(`[INVESTMENT_CREATE] Checking idempotency - idempotencyKey: ${idempotencyKey}`);
        const existing = await this.checkInvestmentIdempotency(idempotencyKey);
        if (existing) {
          this.logger.log(
            `[INVESTMENT_CREATE] Idempotent request - returning existing investment - ` +
            `idempotencyKey: ${idempotencyKey}, investmentId: ${existing.id}`,
          );
          return existing;
        }
        this.logger.debug(`[INVESTMENT_CREATE] No existing investment found for idempotency key`);
      }

      // Create investment record
      const status = proposalId ? 'pending_approval' : 'approved';
      this.logger.log(
        `[INVESTMENT_CREATE] Creating investment record - ` +
        `chamaId: ${dto.chamaId}, productId: ${dto.productId}, ` +
        `amount: ${dto.amount}, status: ${status}, proposalId: ${proposalId || 'none'}`,
      );
      
      const result = await this.db.query(
        `INSERT INTO investments 
         (chama_id, product_id, proposal_id, amount, interest_rate, expected_return,
          maturity_date, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          dto.chamaId,
          dto.productId,
          proposalId,
          dto.amount,
          product.interest_rate,
          expectedReturn,
          maturityDate,
          status,
          JSON.stringify({ idempotencyKey }),
        ],
      );

      const investment = mapQueryRow(result.rows[0]);
      this.logger.log(
        `[INVESTMENT_CREATE] Investment created successfully - ` +
        `investmentId: ${investment.id}, status: ${investment.status}, ` +
        `expectedReturn: ${expectedReturn}, maturityDate: ${maturityDate.toISOString()}`,
      );

      // Mark idempotency
      if (dto.idempotencyKey) {
        await this.markInvestmentIdempotency(idempotencyKey, investment);
      }

      return investment;
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Execute approved investment (transfer funds and activate) - Queued
   */
  async executeInvestment(
    investmentId: string,
    executedBy: string,
    idempotencyKey?: string,
  ): Promise<any> {
    // Generate idempotency key if not provided
    const key = idempotencyKey || uuidv4();
    const externalReference = `investment-exec-${investmentId}-${Date.now()}`;

    this.logger.log(
      `[INVESTMENT_EXECUTE] Queuing investment execution - ` +
      `investmentId: ${investmentId}, executedBy: ${executedBy}, ` +
      `idempotencyKey: ${key}, externalReference: ${externalReference}`,
    );

    try {
      // Enqueue investment execution job
      const job = await this.investmentQueue.add(
        'execute-investment',
        {
          investmentId,
          executedBy,
          idempotencyKey: key,
          externalReference,
        },
        {
          jobId: key, // Use idempotency key as job ID for deduplication
          removeOnComplete: true,
        },
      );

      this.logger.log(
        `[INVESTMENT_EXECUTE] Investment execution queued successfully - ` +
        `investmentId: ${investmentId}, jobId: ${job.id}, ` +
        `idempotencyKey: ${key}`,
      );

      return {
        jobId: job.id,
        status: 'queued',
        externalReference,
        idempotencyKey: key,
        message: 'Investment execution queued for processing',
      };
    } catch (error: any) {
      this.logger.error(
        `[INVESTMENT_EXECUTE] Failed to queue investment execution - ` +
        `investmentId: ${investmentId}, executedBy: ${executedBy}, ` +
        `idempotencyKey: ${key}, error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get investments for a chama
   */
  async getChamaInvestments(
    chamaId: string,
    filters?: {
      status?: InvestmentStatus;
      productType?: InvestmentProductType;
    },
  ): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = `
        SELECT i.*, 
               p.name as product_name,
               p.product_type,
               p.risk_rating,
               p.maturity_days
        FROM investments i
        JOIN investment_products p ON i.product_id = p.id
        WHERE i.chama_id = $1
      `;
      const params: any[] = [chamaId];
      let paramIndex = 2;

      if (filters?.status) {
        query += ` AND i.status = $${paramIndex++}`;
        params.push(filters.status);
      }

      if (filters?.productType) {
        query += ` AND p.product_type = $${paramIndex++}`;
        params.push(filters.productType);
      }

      query += ' ORDER BY i.created_at DESC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get investment by ID
   */
  async getInvestmentById(investmentId: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `SELECT i.*, 
                p.name as product_name,
                p.product_type,
                p.description as product_description,
                c.name as chama_name
         FROM investments i
         JOIN investment_products p ON i.product_id = p.id
         JOIN chamas c ON i.chama_id = c.id
         WHERE i.id = $1`,
        [investmentId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException('Investment not found');
      }

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get investment portfolio summary for a chama
   */
  async getPortfolioSummary(chamaId: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `SELECT 
          COUNT(*) as total_investments,
          COUNT(*) FILTER (WHERE status = 'active') as active_investments,
          COUNT(*) FILTER (WHERE status = 'matured') as matured_investments,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('active', 'approved')), 0) as total_invested,
          COALESCE(SUM(interest_earned), 0) as total_interest_earned,
          COALESCE(SUM(total_return), 0) as total_returns,
          COALESCE(SUM(expected_return) FILTER (WHERE status = 'active'), 0) as expected_returns
         FROM investments
         WHERE chama_id = $1`,
        [chamaId],
      );

      // Always return a valid object, even if no investments exist
      const summary = result.rows[0] 
        ? mapQueryRow(result.rows[0])
        : {
            total_investments: 0,
            active_investments: 0,
            matured_investments: 0,
            total_invested: 0,
            total_interest_earned: 0,
            total_returns: 0,
            expected_returns: 0,
          };

      return summary || {
        total_investments: 0,
        active_investments: 0,
        matured_investments: 0,
        total_invested: 0,
        total_interest_earned: 0,
        total_returns: 0,
        expected_returns: 0,
      };
    } catch (error) {
      // Return default summary on error
      return {
        total_investments: 0,
        active_investments: 0,
        matured_investments: 0,
        total_invested: 0,
        total_interest_earned: 0,
        total_returns: 0,
        expected_returns: 0,
      };
    } finally {
      await this.db.clearContext();
    }
  }

  // ============================================================================
  // INVESTMENT POOLS
  // ============================================================================

  /**
   * Create investment pool
   */
  async createPool(dto: CreateInvestmentPoolDto): Promise<any> {
    await this.db.setSystemContext();

    try {
      // Verify product is pool type
      const product = await this.getProductById(dto.productId);
      if (product.product_type !== 'investment_pool') {
        throw new BadRequestException(
          'Product must be of type investment_pool',
        );
      }

      const result = await this.db.query(
        `INSERT INTO investment_pools 
         (product_id, name, description, target_amount, minimum_contribution, closing_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'open')
         RETURNING *`,
        [
          dto.productId,
          dto.name,
          dto.description || null,
          dto.targetAmount,
          dto.minimumContribution,
          dto.closingDate || null,
        ],
      );

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Contribute to investment pool
   */
  async contributeToPool(dto: ContributeToPoolDto): Promise<any> {
    await this.db.setSystemContext();

    try {
      // Get pool details
      const poolResult = await this.db.query(
        'SELECT * FROM investment_pools WHERE id = $1',
        [dto.poolId],
      );

      if (poolResult.rowCount === 0) {
        throw new NotFoundException('Investment pool not found');
      }

      const pool = mapQueryRow(poolResult.rows[0]);

      if (pool.status !== 'open') {
        throw new BadRequestException(`Pool is ${pool.status}`);
      }

      if (dto.amount < pool.minimum_contribution) {
        throw new BadRequestException(
          `Minimum contribution is ${pool.minimum_contribution}`,
        );
      }

      if (pool.current_amount + dto.amount > pool.target_amount) {
        throw new BadRequestException(
          `Contribution would exceed target amount`,
        );
      }

      // Note: Fund transfer for pool contributions will be handled when pool is fully funded
      // For now, we just track the contribution commitment
      // TODO: Implement actual fund transfer when pool reaches target amount
      // const transaction = await this.ledger.processChamaTransfer({
      //   sourceChamaId: dto.chamaId,
      //   destinationType: 'investment',
      //   amount: dto.amount,
      //   reason: `Contribution to pool: ${pool.name}`,
      //   initiatedBy: dto.userId || 'system',
      //   externalReference: `pool-contribution-${dto.poolId}`,
      // });
      
      // Record contribution (fund transfer will happen when pool is fully funded)
      const contributionResult = await this.db.query(
        `INSERT INTO pool_contributions 
         (pool_id, chama_id, user_id, amount, wallet_transaction_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          dto.poolId,
          dto.chamaId,
          dto.userId || null,
          dto.amount,
          null, // Transaction ID will be set when funds are actually transferred
        ],
      );

      // Update pool current amount
      await this.db.query(
        `UPDATE investment_pools 
         SET current_amount = current_amount + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [dto.amount, dto.poolId],
      );

      return mapQueryRow(contributionResult.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get pool details with contributions
   */
  async getPoolDetails(poolId: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      const poolResult = await this.db.query(
        `SELECT p.*, pr.name as product_name
         FROM investment_pools p
         JOIN investment_products pr ON p.product_id = pr.id
         WHERE p.id = $1`,
        [poolId],
      );

      if (poolResult.rowCount === 0) {
        throw new NotFoundException('Investment pool not found');
      }

      const pool = mapQueryRow(poolResult.rows[0]);

      // Get contributions
      const contributionsResult = await this.db.query(
        `SELECT pc.*, c.name as chama_name, u.full_name as user_name
         FROM pool_contributions pc
         LEFT JOIN chamas c ON pc.chama_id = c.id
         LEFT JOIN users u ON pc.user_id = u.id
         WHERE pc.pool_id = $1
         ORDER BY pc.created_at DESC`,
        [poolId],
      );

      pool.contributions = mapQueryResult(contributionsResult.rows);

      return pool;
    } finally {
      await this.db.clearContext();
    }
  }

  // ============================================================================
  // PROFIT DISTRIBUTION
  // ============================================================================

  /**
   * Distribute dividend/interest for an investment - Queued
   */
  async distributeDividend(dto: DistributeDividendDto): Promise<any> {
    // Generate idempotency key if not provided
    const idempotencyKey = dto.idempotencyKey || uuidv4();
    const externalReference = dto.externalReference || `dividend-${dto.investmentId}-${Date.now()}`;

    this.logger.log(
      `[DIVIDEND_DISTRIBUTE] Queuing dividend distribution - ` +
      `investmentId: ${dto.investmentId}, amount: ${dto.amount}, ` +
      `distributedBy: ${dto.distributedBy || 'system'}, ` +
      `idempotencyKey: ${idempotencyKey}, externalReference: ${externalReference}`,
    );

    try {
      // Enqueue dividend distribution job
      const job = await this.investmentQueue.add(
        'distribute-dividend',
        {
          investmentId: dto.investmentId,
          amount: dto.amount,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          distributedBy: dto.distributedBy,
          idempotencyKey,
          externalReference,
        },
        {
          jobId: idempotencyKey, // Use idempotency key as job ID for deduplication
          removeOnComplete: true,
        },
      );

      this.logger.log(
        `[DIVIDEND_DISTRIBUTE] Dividend distribution queued successfully - ` +
        `investmentId: ${dto.investmentId}, jobId: ${job.id}, ` +
        `idempotencyKey: ${idempotencyKey}`,
      );

      return {
        jobId: job.id,
        status: 'queued',
        externalReference,
        idempotencyKey,
        message: 'Dividend distribution queued for processing',
      };
    } catch (error: any) {
      this.logger.error(
        `[DIVIDEND_DISTRIBUTE] Failed to queue dividend distribution - ` +
        `investmentId: ${dto.investmentId}, amount: ${dto.amount}, ` +
        `idempotencyKey: ${idempotencyKey}, error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Internal method to actually distribute dividend (called by queue processor)
   */
  async _distributeDividendInternal(dto: DistributeDividendDto): Promise<any> {
    await this.db.setSystemContext();

    try {
      // Get investment details
      const investment = await this.getInvestmentById(dto.investmentId);

      if (investment.status !== 'active') {
        throw new BadRequestException(
          `Cannot distribute dividend for investment with status: ${investment.status}`,
        );
      }

      // Get investment shares (for pooled investments)
      const sharesResult = await this.db.query(
        'SELECT * FROM investment_shares WHERE investment_id = $1',
        [dto.investmentId],
      );

      const shares = mapQueryResult(sharesResult.rows);

      if (shares.length === 0) {
        // Single chama investment - distribute to chama
        const dividendResult = await this.db.query(
          `INSERT INTO dividends 
           (investment_id, amount, payment_date, period_start, period_end,
            recipient_chama_id, status, distributed_to_wallet)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            dto.investmentId,
            dto.amount,
            dto.paymentDate,
            dto.periodStart || null,
            dto.periodEnd || null,
            investment.chama_id,
            dto.distributeToWallet ? 'distributed' : 'pending',
            dto.distributeToWallet || false,
          ],
        );

        const dividend = mapQueryRow(dividendResult.rows[0]);

        // If distributing to wallet, transfer funds
        if (dto.distributeToWallet) {
          // Transfer dividend to chama wallet
          // This would use ledger service to transfer from investment account to chama wallet
          // For now, we'll just mark it as distributed
          // In full implementation, you'd call ledger.processChamaDeposit or similar
        }

        // Update investment totals
        await this.db.query(
          `UPDATE investments 
           SET interest_earned = interest_earned + $1,
               total_return = total_return + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [dto.amount, dto.investmentId],
        );

        return dividend;
      } else {
        // Pooled investment - distribute proportionally
        const totalInvested = shares.reduce(
          (sum, share) => sum + parseFloat(share.amount_invested),
          0,
        );

        const dividends: any[] = [];

        for (const share of shares) {
          const shareAmount = (dto.amount * share.ownership_percentage) / 100;

          const dividendResult = await this.db.query(
            `INSERT INTO dividends 
             (investment_id, share_id, amount, payment_date, period_start, period_end,
              recipient_chama_id, recipient_user_id, status, distributed_to_wallet)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              dto.investmentId,
              share.id,
              shareAmount,
              dto.paymentDate,
              dto.periodStart || null,
              dto.periodEnd || null,
              share.chama_id,
              share.user_id || null,
              dto.distributeToWallet ? 'distributed' : 'pending',
              dto.distributeToWallet || false,
            ],
          );

          dividends.push(mapQueryRow(dividendResult.rows[0]));

          // Update share totals
          await this.db.query(
            `UPDATE investment_shares 
             SET interest_share = interest_share + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [shareAmount, share.id],
          );

          // If distributing to wallet, transfer funds
          if (dto.distributeToWallet) {
            if (share.user_id) {
              // Transfer to user wallet
              // await this.ledger.processPayout(share.chama_id, share.user_id, shareAmount, ...);
            } else {
              // Transfer to chama wallet
              // await this.ledger.processChamaDeposit(share.chama_id, shareAmount, ...);
            }
          }
        }

        // Update investment totals
        await this.db.query(
          `UPDATE investments 
           SET interest_earned = interest_earned + $1,
               total_return = total_return + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [dto.amount, dto.investmentId],
        );

        return dividends;
      }
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get dividends for an investment
   */
  async getInvestmentDividends(investmentId: string): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `SELECT d.*, 
                c.name as recipient_chama_name,
                u.full_name as recipient_user_name
         FROM dividends d
         LEFT JOIN chamas c ON d.recipient_chama_id = c.id
         LEFT JOIN users u ON d.recipient_user_id = u.id
         WHERE d.investment_id = $1
         ORDER BY d.payment_date DESC`,
        [investmentId],
      );

      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  // ============================================================================
  // MATURITY TRACKING
  // ============================================================================

  /**
   * Mark investment as matured
   */
  async markInvestmentMatured(investmentId: string): Promise<any> {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `UPDATE investments 
         SET status = 'matured',
             actual_maturity_date = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND status = 'active'
         RETURNING *`,
        [investmentId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException('Investment not found or not active');
      }

      return mapQueryRow(result.rows[0]);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get investments maturing soon (for reminders)
   */
  async getInvestmentsMaturingSoon(
    daysAhead: number = 7,
    chamaId?: string,
  ): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = `
        SELECT i.*, 
               p.name as product_name,
               c.name as chama_name,
               (i.maturity_date - CURRENT_DATE) as days_until_maturity
        FROM investments i
        JOIN investment_products p ON i.product_id = p.id
        JOIN chamas c ON i.chama_id = c.id
        WHERE i.status = 'active'
          AND i.maturity_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysAhead} days'
      `;

      const params: any[] = [];
      if (chamaId) {
        query += ' AND i.chama_id = $1';
        params.push(chamaId);
      }

      query += ' ORDER BY i.maturity_date ASC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get overdue investments (past maturity date)
   */
  async getOverdueInvestments(chamaId?: string): Promise<any[]> {
    await this.db.setSystemContext();

    try {
      let query = `
        SELECT i.*, 
               p.name as product_name,
               c.name as chama_name,
               (CURRENT_DATE - i.maturity_date) as days_overdue
        FROM investments i
        JOIN investment_products p ON i.product_id = p.id
        JOIN chamas c ON i.chama_id = c.id
        WHERE i.status = 'active'
          AND i.maturity_date < CURRENT_DATE
      `;

      const params: any[] = [];
      if (chamaId) {
        query += ' AND i.chama_id = $1';
        params.push(chamaId);
      }

      query += ' ORDER BY i.maturity_date ASC';

      const result = await this.db.query(query, params);
      return mapQueryResult(result.rows);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Check idempotency for investment creation
   */
  private async checkInvestmentIdempotency(idempotencyKey: string): Promise<any | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM investments 
         WHERE metadata->>'idempotencyKey' = $1
         LIMIT 1`,
        [idempotencyKey],
      );
      if (result.rows.length > 0) {
        return mapQueryRow(result.rows[0]);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to check investment idempotency: ${error.message}`);
    }
    return null;
  }

  /**
   * Mark investment idempotency (stored in metadata)
   */
  private async markInvestmentIdempotency(idempotencyKey: string, investment: any): Promise<void> {
    // Already stored in metadata during creation, no additional action needed
    this.logger.debug(`Marked investment idempotency: ${idempotencyKey} for investment ${investment.id}`);
  }
}

