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
import { InterChamaLendingService } from './inter-chama-lending.service';
import type {
  CreateInterChamaRequestDto,
  NegotiateTermsDto,
  ApproveInterChamaRequestDto,
  RejectInterChamaRequestDto,
  MakeInterChamaRepaymentDto,
  InterChamaRequestStatus,
  InterChamaLoanStatus,
} from './inter-chama-lending.service';

@Controller({ path: 'lending/inter-chama', version: '1' })
@UseGuards(JwtAuthGuard)
export class InterChamaLendingController {
  constructor(
    private readonly interChamaLendingService: InterChamaLendingService,
  ) {}

  // ============================================================================
  // LOAN REQUESTS
  // ============================================================================

  /**
   * Create an inter-chama loan request
   */
  @Post('requests')
  @RateLimit({ max: 5, window: 3600 }) // 5 requests per hour
  async createLoanRequest(
    @Request() req: any,
    @Body() dto: CreateInterChamaRequestDto,
  ) {
    const request = await this.interChamaLendingService.createLoanRequest(
      req.user.id,
      dto,
    );

    return {
      success: true,
      message: 'Loan request submitted successfully',
      data: request,
    };
  }

  /**
   * Get loan requests for a chama
   */
  @Get('chama/:chamaId/requests')
  async getChamaLoanRequests(
    @Param('chamaId') chamaId: string,
    @Query('role') role?: 'requesting' | 'lending',
    @Query('status') status?: InterChamaRequestStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const requests = await this.interChamaLendingService.getChamaLoanRequests(
      chamaId,
      role,
      status,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      data: requests,
    };
  }

  /**
   * Negotiate terms for a loan request
   */
  @Put('requests/:id/negotiate')
  @RateLimit({ max: 10, window: 60 })
  async negotiateTerms(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: NegotiateTermsDto,
  ) {
    const dto: NegotiateTermsDto = {
      requestId: id,
      finalInterestRate: body.finalInterestRate,
      finalRepaymentPeriodMonths: body.finalRepaymentPeriodMonths,
      finalCollateral: body.finalCollateral,
      finalCollateralValue: body.finalCollateralValue,
      notes: body.notes,
    };

    const request = await this.interChamaLendingService.negotiateTerms(dto);

    return {
      success: true,
      message: 'Terms negotiated',
      data: request,
    };
  }

  /**
   * Approve loan request (from either side)
   */
  @Put('requests/:id/approve')
  @RateLimit({ max: 20, window: 60 })
  async approveRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      side: 'requesting' | 'lending';
      finalInterestRate?: number;
      finalRepaymentPeriodMonths?: number;
    },
  ) {
    const dto: ApproveInterChamaRequestDto = {
      requestId: id,
      approvedBy: req.user.id,
      side: body.side,
      finalInterestRate: body.finalInterestRate,
      finalRepaymentPeriodMonths: body.finalRepaymentPeriodMonths,
    };

    const request = await this.interChamaLendingService.approveRequest(dto);

    return {
      success: true,
      message: 'Loan request approved',
      data: request,
    };
  }

  /**
   * Reject loan request
   */
  @Put('requests/:id/reject')
  @RateLimit({ max: 20, window: 60 })
  async rejectRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { side: 'requesting' | 'lending'; reason: string },
  ) {
    const dto: RejectInterChamaRequestDto = {
      requestId: id,
      rejectedBy: req.user.id,
      side: body.side,
      reason: body.reason,
    };

    const request = await this.interChamaLendingService.rejectRequest(dto);

    return {
      success: true,
      message: 'Loan request rejected',
      data: request,
    };
  }

  // ============================================================================
  // LOANS
  // ============================================================================

  /**
   * Get inter-chama loans for a chama
   */
  @Get('chama/:chamaId/loans')
  async getChamaInterChamaLoans(
    @Param('chamaId') chamaId: string,
    @Query('role') role?: 'requesting' | 'lending',
    @Query('status') status?: InterChamaLoanStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const loans = await this.interChamaLendingService.getChamaInterChamaLoans(
      chamaId,
      role,
      status,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      data: loans,
    };
  }

  /**
   * Disburse inter-chama loan
   */
  @Put('loans/:id/disburse')
  @RateLimit({ max: 10, window: 60 })
  async disburseLoan(@Request() req: any, @Param('id') id: string) {
    const loan = await this.interChamaLendingService.disburseLoan(
      id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Loan disbursed successfully',
      data: loan,
    };
  }

  // ============================================================================
  // REPAYMENTS
  // ============================================================================

  /**
   * Make repayment on inter-chama loan
   */
  @Post('loans/:id/repay')
  @RateLimit({ max: 10, window: 60 })
  async makeRepayment(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      paymentReference?: string;
      notes?: string;
    },
  ) {
    // Get loan to determine requesting chama
    const loan = await this.interChamaLendingService.getLoanById(id);
    
    // Validate user is admin/treasurer of requesting chama
    // (This validation should be done in the service, but for now we pass the chama ID)
    
    const dto: MakeInterChamaRepaymentDto = {
      loanId: id,
      amount: body.amount,
      paymentReference: body.paymentReference,
      notes: body.notes,
    };

    const result = await this.interChamaLendingService.makeRepayment(
      loan.requestingChamaId,
      dto,
    );

    return {
      success: true,
      message: 'Repayment processed successfully',
      data: result,
    };
  }

  // ============================================================================
  // SUMMARY & ANALYTICS
  // ============================================================================

  /**
   * Get inter-chama lending summary for a chama
   */
  @Get('chama/:chamaId/summary')
  async getChamaInterChamaLendingSummary(@Param('chamaId') chamaId: string) {
    const summary =
      await this.interChamaLendingService.getChamaInterChamaLendingSummary(
        chamaId,
      );

    return {
      success: true,
      data: summary,
    };
  }
}

