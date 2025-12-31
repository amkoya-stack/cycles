import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { ExternalLendingService } from './external-lending.service';
import type {
  CreateListingDto,
  CreateExternalApplicationDto,
  MarketplaceFilters,
  ExternalApplicationStatus,
} from './external-lending.service';

@Controller({ path: 'lending/external', version: '1' })
export class ExternalLendingController {
  constructor(private readonly externalLendingService: ExternalLendingService) {}

  // ============================================================================
  // MARKETPLACE LISTINGS
  // ============================================================================

  /**
   * Browse marketplace (public, no auth required for viewing)
   */
  @Get('marketplace')
  async browseMarketplace(
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('minInterestRate') minInterestRate?: string,
    @Query('maxInterestRate') maxInterestRate?: string,
    @Query('minPeriodMonths') minPeriodMonths?: string,
    @Query('maxPeriodMonths') maxPeriodMonths?: string,
    @Query('allowsRiskSharing') allowsRiskSharing?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: MarketplaceFilters = {};

    if (minAmount) filters.minAmount = parseFloat(minAmount);
    if (maxAmount) filters.maxAmount = parseFloat(maxAmount);
    if (minInterestRate) filters.minInterestRate = parseFloat(minInterestRate);
    if (maxInterestRate) filters.maxInterestRate = parseFloat(maxInterestRate);
    if (minPeriodMonths) filters.minPeriodMonths = parseInt(minPeriodMonths);
    if (maxPeriodMonths) filters.maxPeriodMonths = parseInt(maxPeriodMonths);
    if (allowsRiskSharing) filters.allowsRiskSharing = allowsRiskSharing === 'true';
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const listings = await this.externalLendingService.browseMarketplace(filters);

    return {
      success: true,
      data: listings,
    };
  }

  /**
   * Get listing details (public)
   */
  @Get('listings/:id')
  async getListingDetails(@Param('id') id: string) {
    const listing = await this.externalLendingService.getListingDetails(id);

    return {
      success: true,
      data: listing,
    };
  }

  /**
   * Create a loan listing (chama offering loans)
   */
  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 5, window: 3600 }) // 5 listings per hour
  async createListing(@Request() req: any, @Body() dto: CreateListingDto) {
    const listing = await this.externalLendingService.createListing(
      req.user.id,
      dto,
    );

    return {
      success: true,
      message: 'Loan listing created successfully',
      data: listing,
    };
  }

  /**
   * Get chama's listings (public)
   */
  @Get('chama/:chamaId/listings')
  async getChamaListings(@Param('chamaId') chamaId: string) {
    // This would require a new method in the service
    // For now, return empty array
    return {
      success: true,
      data: [],
      message: 'Feature coming soon',
    };
  }

  // ============================================================================
  // EXTERNAL LOAN APPLICATIONS
  // ============================================================================

  /**
   * Apply for an external loan
   */
  @Post('applications')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 5, window: 3600 }) // 5 applications per hour
  async applyForExternalLoan(
    @Request() req: any,
    @Body() dto: CreateExternalApplicationDto,
  ) {
    const application = await this.externalLendingService.createExternalApplication(
      req.user.id,
      dto,
    );

    return {
      success: true,
      message: 'Loan application submitted successfully',
      data: application,
    };
  }

  /**
   * Get my external loan applications
   */
  @Get('applications/me')
  @UseGuards(JwtAuthGuard)
  async getMyExternalApplications(@Request() req: any) {
    const applications = await this.externalLendingService.getUserExternalApplications(
      req.user.id,
    );

    return {
      success: true,
      data: applications,
    };
  }

  /**
   * Get external applications for a chama (admin/treasurer)
   */
  @Get('chama/:chamaId/applications')
  @UseGuards(JwtAuthGuard)
  async getChamaExternalApplications(
    @Param('chamaId') chamaId: string,
    @Query('status') status?: ExternalApplicationStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const applications = await this.externalLendingService.getChamaExternalApplications(
      chamaId,
      status,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      data: applications,
    };
  }

  /**
   * Approve external loan application
   */
  @Put('applications/:id/approve')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 20, window: 60 })
  async approveExternalApplication(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      finalInterestRate?: number;
      finalRepaymentPeriodMonths?: number;
      repaymentFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    },
  ) {
    const application = await this.externalLendingService.approveExternalApplication(
      id,
      req.user.id,
      body.finalInterestRate,
      body.finalRepaymentPeriodMonths,
      body.repaymentFrequency,
    );

    return {
      success: true,
      message: 'Loan application approved',
      data: application,
    };
  }

  /**
   * Reject external loan application
   */
  @Put('applications/:id/reject')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 20, window: 60 })
  async rejectExternalApplication(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    const application = await this.externalLendingService.rejectExternalApplication(
      id,
      req.user.id,
      body.reason,
    );

    return {
      success: true,
      message: 'Loan application rejected',
      data: application,
    };
  }

  // ============================================================================
  // ESCROW MANAGEMENT
  // ============================================================================

  /**
   * Create escrow account for approved application
   */
  @Post('applications/:id/escrow')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 10, window: 60 })
  async createEscrow(@Request() req: any, @Param('id') applicationId: string) {
    const escrow = await this.externalLendingService.createEscrowAccount(applicationId, req.user.id);

    return {
      success: true,
      message: 'Escrow account created',
      data: escrow,
    };
  }

  /**
   * Fund escrow account
   */
  @Put('escrow/:id/fund')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 10, window: 60 })
  async fundEscrow(@Request() req: any, @Param('id') escrowId: string) {
    const escrow = await this.externalLendingService.fundEscrowAccount(
      escrowId,
      req.user.id,
    );

    return {
      success: true,
      message: 'Escrow account funded',
      data: escrow,
    };
  }

  /**
   * Release escrow funds to borrower
   */
  @Put('escrow/:id/release')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 10, window: 60 })
  async releaseEscrow(@Request() req: any, @Param('id') escrowId: string) {
    const escrow = await this.externalLendingService.releaseEscrow(
      escrowId,
      req.user.id,
    );

    return {
      success: true,
      message: 'Escrow funds released to borrower',
      data: escrow,
    };
  }

  /**
   * Get escrow account details
   */
  @Get('escrow/:id')
  @UseGuards(JwtAuthGuard)
  async getEscrowDetails(@Param('id') escrowId: string) {
    const escrow = await this.externalLendingService.getEscrowAccount(escrowId);

    return {
      success: true,
      data: escrow,
    };
  }

  // ============================================================================
  // RISK SHARING
  // ============================================================================

  /**
   * Create or update risk sharing agreement
   */
  @Post('applications/:id/risk-sharing')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 10, window: 60 })
  async createRiskSharing(
    @Request() req: any,
    @Param('id') applicationId: string,
    @Body()
    body: {
      primaryChamaId: string;
      primaryChamaAmount: number;
      coFunders: Array<{ chamaId: string; amount: number }>;
    },
  ) {
    const agreement = await this.externalLendingService.createRiskSharingAgreement(
      applicationId,
      body.primaryChamaId,
      body.primaryChamaAmount,
      body.coFunders,
    );

    return {
      success: true,
      message: 'Risk sharing agreement created',
      data: agreement,
    };
  }

  /**
   * Get risk sharing agreement for an application
   */
  @Get('applications/:id/risk-sharing')
  @UseGuards(JwtAuthGuard)
  async getRiskSharing(@Param('id') applicationId: string) {
    const agreement = await this.externalLendingService.getRiskSharingAgreement(
      applicationId,
    );

    if (!agreement) {
      return {
        success: true,
        data: null,
        message: 'No risk sharing agreement found',
      };
    }

    return {
      success: true,
      data: agreement,
    };
  }
}

