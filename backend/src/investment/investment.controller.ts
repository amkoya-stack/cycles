/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { FeatureFlag } from '../common/decorators/feature-flag.decorator';
import { InvestmentService } from './investment.service';

@Controller({ path: 'investment', version: '1' })
@UseGuards(JwtAuthGuard)
export class InvestmentController {
  private readonly logger = new Logger(InvestmentController.name);

  constructor(private readonly investmentService: InvestmentService) {}

  // ============================================================================
  // INVESTMENT PRODUCTS
  // ============================================================================

  /**
   * Get all investment products (marketplace)
   * GET /api/v1/investment/products
   */
  @Get('products')
  async getProducts(
    @Query('productType') productType?: string,
    @Query('isActive') isActive?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('minInterestRate') minInterestRate?: string,
    @Query('maxRiskRating') maxRiskRating?: string,
  ) {
    const filters: any = {};
    if (productType) filters.productType = productType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (isFeatured !== undefined) filters.isFeatured = isFeatured === 'true';
    if (minInterestRate) filters.minInterestRate = parseFloat(minInterestRate);
    if (maxRiskRating) filters.maxRiskRating = parseInt(maxRiskRating, 10);

    return this.investmentService.getProducts(filters);
  }

  /**
   * Get investment product by ID
   * GET /api/v1/investment/products/:id
   */
  @Get('products/:id')
  async getProductById(@Param('id') id: string) {
    return this.investmentService.getProductById(id);
  }

  /**
   * Create investment product (admin only - will add admin guard later)
   * POST /api/v1/investment/products
   */
  @Post('products')
  @RateLimit({ max: 10, window: 3600 }) // 10 products per hour
  @FeatureFlag({ flagKey: 'investment_module_enabled' })
  async createProduct(@Body() dto: any) {
    return this.investmentService.createProduct(dto);
  }

  /**
   * Update investment product (admin only)
   * PUT /api/v1/investment/products/:id
   */
  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() updates: any) {
    return this.investmentService.updateProduct(id, updates);
  }

  // ============================================================================
  // INVESTMENTS
  // ============================================================================

  /**
   * Create investment proposal
   * POST /api/v1/investment/investments
   */
  @Post('investments')
  @RateLimit({ max: 5, window: 3600 }) // 5 investments per hour
  @FeatureFlag({ flagKey: 'investment_module_enabled' })
  async createInvestment(@Req() req: any, @Body() dto: any) {
    const userId = req.user.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const idempotencyKey = dto.idempotencyKey || req.headers['idempotency-key'];

    this.logger.log(
      `[API_CREATE_INVESTMENT] Request received - ` +
      `userId: ${userId}, chamaId: ${dto.chamaId}, ` +
      `productId: ${dto.productId}, amount: ${dto.amount}, ` +
      `ipAddress: ${ipAddress}, idempotencyKey: ${idempotencyKey || 'none'}`,
    );

    try {
      const result = await this.investmentService.createInvestment(
        { ...dto, idempotencyKey },
        userId,
      );

      this.logger.log(
        `[API_CREATE_INVESTMENT] Request completed successfully - ` +
        `userId: ${userId}, investmentId: ${result.id}, ` +
        `status: ${result.status}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `[API_CREATE_INVESTMENT] Request failed - ` +
        `userId: ${userId}, chamaId: ${dto.chamaId}, ` +
        `productId: ${dto.productId}, amount: ${dto.amount}, ` +
        `ipAddress: ${ipAddress}, error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get investments for a chama
   * GET /api/v1/investment/investments/chama/:chamaId
   */
  @Get('investments/chama/:chamaId')
  async getChamaInvestments(
    @Param('chamaId') chamaId: string,
    @Query('status') status?: string,
    @Query('productType') productType?: string,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (productType) filters.productType = productType;

    return this.investmentService.getChamaInvestments(chamaId, filters);
  }

  /**
   * Get investment by ID
   * GET /api/v1/investment/investments/:id
   */
  @Get('investments/:id')
  async getInvestmentById(@Param('id') id: string) {
    return this.investmentService.getInvestmentById(id);
  }

  /**
   * Execute approved investment
   * POST /api/v1/investment/investments/:id/execute
   */
  @Post('investments/:id/execute')
  @RateLimit({ max: 10, window: 3600 }) // 10 executions per hour
  @FeatureFlag({ flagKey: 'investment_execution_enabled' })
  async executeInvestment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { idempotencyKey?: string },
  ) {
    const userId = req.user.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const idempotencyKey = body.idempotencyKey || req.headers['idempotency-key'];

    this.logger.log(
      `[API_EXECUTE_INVESTMENT] Request received - ` +
      `userId: ${userId}, investmentId: ${id}, ` +
      `ipAddress: ${ipAddress}, idempotencyKey: ${idempotencyKey || 'none'}`,
    );

    try {
      const result = await this.investmentService.executeInvestment(
        id,
        userId,
        idempotencyKey,
      );

      this.logger.log(
        `[API_EXECUTE_INVESTMENT] Request completed successfully - ` +
        `userId: ${userId}, investmentId: ${id}, ` +
        `jobId: ${result.jobId}, status: ${result.status}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `[API_EXECUTE_INVESTMENT] Request failed - ` +
        `userId: ${userId}, investmentId: ${id}, ` +
        `ipAddress: ${ipAddress}, error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get portfolio summary for a chama
   * GET /api/v1/investment/portfolio/:chamaId
   */
  @Get('portfolio/:chamaId')
  async getPortfolioSummary(@Param('chamaId') chamaId: string) {
    return this.investmentService.getPortfolioSummary(chamaId);
  }

  // ============================================================================
  // INVESTMENT POOLS
  // ============================================================================

  /**
   * Create investment pool
   * POST /api/v1/investment/pools
   */
  @Post('pools')
  async createPool(@Body() dto: any) {
    return this.investmentService.createPool(dto);
  }

  /**
   * Contribute to investment pool
   * POST /api/v1/investment/pools/:poolId/contribute
   */
  @Post('pools/:poolId/contribute')
  async contributeToPool(
    @Req() req: any,
    @Param('poolId') poolId: string,
    @Body() body: { chamaId: string; amount: number; userId?: string },
  ) {
    return this.investmentService.contributeToPool({
      poolId,
      ...body,
    });
  }

  /**
   * Get pool details
   * GET /api/v1/investment/pools/:id
   */
  @Get('pools/:id')
  async getPoolDetails(@Param('id') id: string) {
    return this.investmentService.getPoolDetails(id);
  }

  // ============================================================================
  // DIVIDENDS & PROFIT DISTRIBUTION
  // ============================================================================

  /**
   * Distribute dividend for an investment
   * POST /api/v1/investment/investments/:id/dividends
   */
  @Post('investments/:id/dividends')
  @RateLimit({ max: 5, window: 3600 }) // 5 dividend distributions per hour
  @FeatureFlag({ flagKey: 'dividend_distribution_enabled' })
  async distributeDividend(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      paymentDate?: string;
      periodStart?: string;
      periodEnd?: string;
      idempotencyKey?: string;
      distributeToWallet?: boolean;
      reinvest?: boolean;
    },
  ) {
    const userId = req.user.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const idempotencyKey = body.idempotencyKey || req.headers['idempotency-key'];

    this.logger.log(
      `[API_DISTRIBUTE_DIVIDEND] Request received - ` +
      `userId: ${userId}, investmentId: ${id}, ` +
      `amount: ${body.amount}, ipAddress: ${ipAddress}, ` +
      `idempotencyKey: ${idempotencyKey || 'none'}`,
    );

    try {
      const result = await this.investmentService.distributeDividend({
        investmentId: id,
        amount: body.amount,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
        distributedBy: userId,
        idempotencyKey,
      });

      this.logger.log(
        `[API_DISTRIBUTE_DIVIDEND] Request completed successfully - ` +
        `userId: ${userId}, investmentId: ${id}, ` +
        `jobId: ${result.jobId}, status: ${result.status}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `[API_DISTRIBUTE_DIVIDEND] Request failed - ` +
        `userId: ${userId}, investmentId: ${id}, ` +
        `amount: ${body.amount}, ipAddress: ${ipAddress}, ` +
        `error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get dividends for an investment
   * GET /api/v1/investment/investments/:id/dividends
   */
  @Get('investments/:id/dividends')
  async getInvestmentDividends(@Param('id') id: string) {
    return this.investmentService.getInvestmentDividends(id);
  }

  // ============================================================================
  // MATURITY TRACKING
  // ============================================================================

  /**
   * Mark investment as matured
   * POST /api/v1/investment/investments/:id/mature
   */
  @Post('investments/:id/mature')
  async markInvestmentMatured(@Param('id') id: string) {
    return this.investmentService.markInvestmentMatured(id);
  }

  /**
   * Get investments maturing soon
   * GET /api/v1/investment/maturing-soon
   */
  @Get('maturing-soon')
  async getInvestmentsMaturingSoon(
    @Query('daysAhead') daysAhead?: string,
    @Query('chamaId') chamaId?: string,
  ) {
    return this.investmentService.getInvestmentsMaturingSoon(
      daysAhead ? parseInt(daysAhead, 10) : 7,
      chamaId,
    );
  }

  /**
   * Get overdue investments
   * GET /api/v1/investment/overdue
   */
  @Get('overdue')
  async getOverdueInvestments(@Query('chamaId') chamaId?: string) {
    return this.investmentService.getOverdueInvestments(chamaId);
  }
}

