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
import {
  LendingService,
  ApprovalMethod,
} from './lending.service';
import type {
  CreateLoanApplicationDto,
  ApproveLoanDto,
  RejectLoanDto,
  MakeRepaymentDto,
  LoanApplicationStatus,
  LoanStatus,
} from './lending.service';

@Controller({ path: 'lending', version: '1' })
@UseGuards(JwtAuthGuard)
export class LendingController {
  constructor(private readonly lendingService: LendingService) {}

  // ============================================================================
  // LOAN APPLICATIONS
  // ============================================================================

  /**
   * Apply for a loan
   */
  @Post('apply')
  @RateLimit({ max: 5, window: 3600 }) // 5 applications per hour
  async applyForLoan(@Request() req: any, @Body() dto: CreateLoanApplicationDto) {
    const application = await this.lendingService.createLoanApplication(
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
   * Get my loan applications
   */
  @Get('applications/me')
  async getMyApplications(
    @Request() req: any,
    @Query('chamaId') chamaId?: string,
  ) {
    const applications = await this.lendingService.getUserLoanApplications(
      req.user.id,
      chamaId,
    );

    return {
      success: true,
      data: applications,
    };
  }

  /**
   * Withdraw my loan application
   */
  @Put('applications/:id/withdraw')
  async withdrawApplication(@Request() req: any, @Param('id') id: string) {
    const application = await this.lendingService.withdrawLoanApplication(
      id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Loan application withdrawn',
      data: application,
    };
  }

  /**
   * Get loan applications for a chama (admin/treasurer)
   */
  @Get('chama/:chamaId/applications')
  async getChamaApplications(
    @Param('chamaId') chamaId: string,
    @Query('status') status?: LoanApplicationStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const applications = await this.lendingService.getChamaLoanApplications(
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
   * Approve a loan application (admin/treasurer)
   */
  @Put('applications/:id/approve')
  @RateLimit({ max: 20, window: 60 })
  async approveApplication(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      approvalMethod?: ApprovalMethod;
      finalInterestRate?: number;
      finalRepaymentPeriodMonths?: number;
      gracePeriodDays?: number;
      repaymentFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
      notes?: string;
    },
  ) {
    const dto: ApproveLoanDto = {
      applicationId: id,
      approvedBy: req.user.id,
      approvalMethod: body.approvalMethod || ApprovalMethod.ADMIN,
      finalInterestRate: body.finalInterestRate,
      finalRepaymentPeriodMonths: body.finalRepaymentPeriodMonths,
      gracePeriodDays: body.gracePeriodDays,
      repaymentFrequency: body.repaymentFrequency,
      notes: body.notes,
    };

    const application = await this.lendingService.approveLoanApplication(dto);

    return {
      success: true,
      message: 'Loan application approved',
      data: application,
    };
  }

  /**
   * Reject a loan application (admin/treasurer)
   */
  @Put('applications/:id/reject')
  @RateLimit({ max: 20, window: 60 })
  async rejectApplication(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    const dto: RejectLoanDto = {
      applicationId: id,
      rejectedBy: req.user.id,
      reason: body.reason,
    };

    const application = await this.lendingService.rejectLoanApplication(dto);

    return {
      success: true,
      message: 'Loan application rejected',
      data: application,
    };
  }

  // ============================================================================
  // LOANS
  // ============================================================================

  /**
   * Get my loans
   */
  @Get('loans/me')
  async getMyLoans(@Request() req: any, @Query('chamaId') chamaId?: string) {
    const loans = await this.lendingService.getUserLoans(
      req.user.id,
      chamaId,
    );

    return {
      success: true,
      data: loans,
    };
  }

  /**
   * Get loan details with repayment schedule
   */
  @Get('loans/:id')
  async getLoanDetails(@Param('id') id: string) {
    const details = await this.lendingService.getLoanDetails(id);

    return {
      success: true,
      data: details,
    };
  }

  /**
   * Get loans for a chama (admin/treasurer)
   */
  @Get('chama/:chamaId/loans')
  async getChamaLoans(
    @Param('chamaId') chamaId: string,
    @Query('status') status?: LoanStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const loans = await this.lendingService.getChamaLoans(
      chamaId,
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
   * Disburse a loan (admin/treasurer)
   */
  @Put('loans/:id/disburse')
  @RateLimit({ max: 10, window: 60 })
  async disburseLoan(@Request() req: any, @Param('id') id: string) {
    const loan = await this.lendingService.disburseLoan(id, req.user.id);

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
   * Make a loan repayment
   */
  @Post('loans/:id/repay')
  @RateLimit({ max: 10, window: 60 })
  async makeRepayment(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      paymentMethod?: 'wallet' | 'contribution_auto_deduct' | 'manual';
      paymentReference?: string;
      notes?: string;
    },
  ) {
    const dto: MakeRepaymentDto = {
      loanId: id,
      amount: body.amount,
      paymentMethod: body.paymentMethod || 'wallet',
      paymentReference: body.paymentReference,
      notes: body.notes,
    };

    const repayment = await this.lendingService.makeRepayment(
      req.user.id,
      dto,
    );

    return {
      success: true,
      message: 'Repayment processed successfully',
      data: repayment,
    };
  }

  // ============================================================================
  // SUMMARY & ANALYTICS
  // ============================================================================

  /**
   * Get chama lending summary (admin/treasurer)
   */
  @Get('chama/:chamaId/summary')
  async getChamaLendingSummary(@Param('chamaId') chamaId: string) {
    const summary = await this.lendingService.getChamaLendingSummary(chamaId);

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get chama interest income
   */
  @Get('chama/:chamaId/interest-income')
  async getChamaInterestIncome(@Param('chamaId') chamaId: string) {
    const interestIncome = await this.lendingService.getChamaInterestIncome(chamaId);

    return {
      success: true,
      data: { interestIncome },
    };
  }

  /**
   * Get recent lending activities for a chama
   */
  @Get('chama/:chamaId/activities')
  async getChamaRecentActivities(
    @Param('chamaId') chamaId: string,
    @Query('limit') limit?: string,
  ) {
    const activities = await this.lendingService.getChamaRecentActivities(
      chamaId,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      data: activities,
    };
  }

  /**
   * Get all repayments for a chama (for Payments tab)
   */
  @Get('chama/:chamaId/repayments')
  async getChamaRepayments(
    @Param('chamaId') chamaId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const repayments = await this.lendingService.getChamaRepayments(
      chamaId,
      status as any,
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      data: repayments,
    };
  }

  /**
   * Get analytics data for a chama
   */
  @Get('chama/:chamaId/analytics')
  async getChamaAnalytics(@Param('chamaId') chamaId: string) {
    const analytics = await this.lendingService.getChamaAnalytics(chamaId);

    return {
      success: true,
      data: analytics,
    };
  }
}

