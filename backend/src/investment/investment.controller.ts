/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InvestmentService } from './investment.service';
import type {
  CreateInvestmentProductDto,
  CreateInvestmentDto,
  CreateInvestmentPoolDto,
  ContributeToPoolDto,
} from './investment.service';

@Controller({ path: 'investment', version: '1' })
@UseGuards(JwtAuthGuard)
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  // ============================================================================
  // INVESTMENT PRODUCTS
  // ============================================================================

  /**
   * Get all investment products
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
   * Create investment product
   * POST /api/v1/investment/products
   */
  @Post('products')
  async createProduct(@Body() dto: CreateInvestmentProductDto) {
    return this.investmentService.createProduct(dto);
  }

  /**
   * Update investment product
   * PUT /api/v1/investment/products/:id
   */
  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() updates: Partial<CreateInvestmentProductDto>,
  ) {
    return this.investmentService.updateProduct(id, updates);
  }

  // ============================================================================
  // INVESTMENTS
  // ============================================================================

  /**
   * Get investments for a chama
   * GET /api/v1/investment/investments/chama/:chamaId
   */
  @Get('investments/chama/:chamaId')
  async getChamaInvestments(
    @Param('chamaId') chamaId: string,
    @Query('status') status?: string,
    @Query('productType') productType?: string | string[],
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (productType) {
      // Handle both single string, array of strings, and comma-separated string
      if (Array.isArray(productType)) {
        filters.productType = productType;
      } else if (productType.includes(',')) {
        // Handle comma-separated string
        filters.productType = productType.split(',').map((t) => t.trim());
      } else {
        filters.productType = [productType];
      }
    }

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
   * Create investment proposal
   * POST /api/v1/investment/investments
   */
  @Post('investments')
  async createInvestment(@Body() dto: CreateInvestmentDto, @Req() req: any) {
    return this.investmentService.createInvestment(dto, req.user.id);
  }

  /**
   * Execute approved investment
   * POST /api/v1/investment/investments/:id/execute
   */
  @Post('investments/:id/execute')
  async executeInvestment(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body?: { idempotencyKey?: string },
  ) {
    return this.investmentService.executeInvestment(
      id,
      req.user.id,
      body?.idempotencyKey,
    );
  }

  /**
   * Get investment portfolio summary for a chama
   * GET /api/v1/investment/portfolio/:chamaId
   */
  @Get('portfolio/:chamaId')
  async getPortfolioSummary(@Param('chamaId') chamaId: string) {
    return this.investmentService.getPortfolioSummary(chamaId);
  }

  /**
   * Get investment dividends
   * GET /api/v1/investment/investments/:id/dividends
   */
  @Get('investments/:id/dividends')
  async getInvestmentDividends(@Param('id') id: string) {
    return this.investmentService.getInvestmentDividends(id);
  }

  /**
   * Get investments maturing soon
   * GET /api/v1/investment/investments/maturing-soon
   */
  @Get('investments/maturing-soon')
  async getInvestmentsMaturingSoon(
    @Query('chamaId') chamaId?: string,
    @Query('days') days?: string,
  ) {
    const daysParam = days ? parseInt(days, 10) : 30;
    return this.investmentService.getInvestmentsMaturingSoon(
      daysParam,
      chamaId,
    );
  }

  /**
   * Get overdue investments
   * GET /api/v1/investment/investments/overdue
   */
  @Get('investments/overdue')
  async getOverdueInvestments(@Query('chamaId') chamaId?: string) {
    return this.investmentService.getOverdueInvestments(chamaId);
  }

  // ============================================================================
  // INVESTMENT POOLS
  // ============================================================================

  /**
   * Create investment pool
   * POST /api/v1/investment/pools
   */
  @Post('pools')
  async createPool(@Body() dto: CreateInvestmentPoolDto) {
    return this.investmentService.createPool(dto);
  }

  /**
   * Get pool details
   * GET /api/v1/investment/pools/:id
   */
  @Get('pools/:id')
  async getPoolDetails(@Param('id') id: string) {
    return this.investmentService.getPoolDetails(id);
  }

  /**
   * Contribute to investment pool
   * POST /api/v1/investment/pools/:id/contribute
   */
  @Post('pools/:id/contribute')
  async contributeToPool(
    @Param('id') id: string,
    @Body() dto: ContributeToPoolDto,
    @Req() req: any,
  ) {
    return this.investmentService.contributeToPool({
      ...dto,
      poolId: id,
      userId: req.user.id,
    });
  }
}
