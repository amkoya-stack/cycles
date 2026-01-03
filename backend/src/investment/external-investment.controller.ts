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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ExternalInvestmentService } from './external-investment.service';

@Controller({ path: 'investment/external', version: '1' })
@UseGuards(JwtAuthGuard)
export class ExternalInvestmentController {
  constructor(
    private readonly externalInvestment: ExternalInvestmentService,
  ) {}

  // ============================================================================
  // EXTERNAL PARTNER MANAGEMENT
  // ============================================================================

  /**
   * Create external investment partner
   * POST /api/v1/investment/external/partners
   */
  @Post('partners')
  async createPartner(@Body() dto: any) {
    return this.externalInvestment.createPartner(dto);
  }

  /**
   * Get all external partners
   * GET /api/v1/investment/external/partners
   */
  @Get('partners')
  async getPartners(
    @Query('providerType') providerType?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters: any = {};
    if (providerType) filters.providerType = providerType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    return this.externalInvestment.getPartners(filters);
  }

  /**
   * Get partner by ID
   * GET /api/v1/investment/external/partners/:id
   */
  @Get('partners/:id')
  async getPartnerById(@Param('id') id: string) {
    return this.externalInvestment.getPartnerById(id);
  }

  /**
   * Test partner API connection
   * POST /api/v1/investment/external/partners/:id/test
   */
  @Post('partners/:id/test')
  async testPartnerConnection(@Param('id') id: string) {
    return this.externalInvestment.testPartnerConnection(id);
  }

  // ============================================================================
  // NAV UPDATES
  // ============================================================================

  /**
   * Update NAV for a product
   * POST /api/v1/investment/external/nav
   */
  @Post('nav')
  async updateNAV(
    @Body()
    body: {
      productId: string;
      navValue: number;
      navDate: string;
      totalUnits?: number;
      totalAssets?: number;
      updateSource?: 'api' | 'manual' | 'reconciliation';
      externalReference?: string;
    },
    @Query('partnerId') partnerId?: string,
  ) {
    return this.externalInvestment.updateNAV({
      ...body,
      navDate: new Date(body.navDate),
    }, partnerId);
  }

  /**
   * Fetch NAV from external partner
   * POST /api/v1/investment/external/nav/fetch
   */
  @Post('nav/fetch')
  async fetchNAVFromPartner(
    @Body() body: { productId: string; partnerId: string },
  ) {
    return this.externalInvestment.fetchNAVFromPartner(
      body.productId,
      body.partnerId,
    );
  }

  /**
   * Get NAV history for a product
   * GET /api/v1/investment/external/nav/:productId/history
   */
  @Get('nav/:productId/history')
  async getNAVHistory(
    @Param('productId') productId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.externalInvestment.getNAVHistory(
      productId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ============================================================================
  // STATEMENT RECONCILIATION
  // ============================================================================

  /**
   * Reconcile external statement
   * POST /api/v1/investment/external/statements/:id/reconcile
   */
  @Post('statements/:id/reconcile')
  async reconcileStatement(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.externalInvestment.reconcileStatement(id, req.user.id);
  }

  /**
   * Get reconciliation discrepancies
   * GET /api/v1/investment/external/reconciliation/discrepancies
   */
  @Get('reconciliation/discrepancies')
  async getDiscrepancies(
    @Query('statementId') statementId?: string,
    @Query('investmentId') investmentId?: string,
    @Query('status') status?: string,
  ) {
    const filters: any = {};
    if (statementId) filters.statementId = statementId;
    if (investmentId) filters.investmentId = investmentId;
    if (status) filters.status = status;

    return this.externalInvestment.getDiscrepancies(filters);
  }
}

