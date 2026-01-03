/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { ReputationService } from '../reputation/reputation.service';
import { MetricsService } from '../common/services/metrics.service';
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum LoanApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  PENDING_VOTE = 'pending_vote',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

export enum LoanStatus {
  PENDING_DISBURSEMENT = 'pending_disbursement',
  ACTIVE = 'active',
  PAID_OFF = 'paid_off',
  DEFAULTED = 'defaulted',
  WRITTEN_OFF = 'written_off',
  CANCELLED = 'cancelled',
}

export enum RepaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  WAIVED = 'waived',
  PARTIAL = 'partial',
}

export enum ApprovalMethod {
  AUTO_APPROVE = 'auto_approve',
  TREASURER = 'treasurer',
  ADMIN = 'admin',
  GROUP_VOTE = 'group_vote',
}

export interface CreateLoanApplicationDto {
  chamaId: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate?: number;
  proposedRepaymentPeriodMonths: number;
  metadata?: Record<string, any>;
}

export interface ApproveLoanDto {
  applicationId: string;
  approvedBy: string;
  approvalMethod: ApprovalMethod;
  finalInterestRate?: number;
  finalRepaymentPeriodMonths?: number;
  gracePeriodDays?: number;
  repaymentFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  notes?: string;
}

export interface RejectLoanDto {
  applicationId: string;
  rejectedBy: string;
  reason: string;
}

export interface MakeRepaymentDto {
  loanId: string;
  amount: number;
  paymentMethod: 'wallet' | 'contribution_auto_deduct' | 'manual';
  paymentReference?: string;
  notes?: string;
}

export interface LoanApplication {
  id: string;
  chamaId: string;
  applicantId: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate: number | null;
  proposedRepaymentPeriodMonths: number;
  status: LoanApplicationStatus;
  approvalMethod: ApprovalMethod | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  requiresVote: boolean;
  voteProposalId: string | null;
  metadata: Record<string, any>;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: string;
  loanApplicationId: string | null;
  chamaId: string;
  borrowerId: string;
  principalAmount: number;
  interestRate: number;
  totalAmount: number;
  repaymentPeriodMonths: number;
  repaymentFrequency: string;
  disbursedAt: Date | null;
  firstPaymentDate: Date;
  maturityDate: Date;
  gracePeriodDays: number;
  status: LoanStatus;
  defaultedAt: Date | null;
  paidOffAt: Date | null;
  amountDisbursed: number;
  totalPaid: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  outstandingBalance: number;
  overdueAmount: number;
  lateFeePenalty: number;
  collateralType: string | null;
  collateralValue: number | null;
  collateralMetadata: Record<string, any> | null;
  agreementDocumentId: string | null;
  agreementSignedAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: Date;
  amountDue: number;
  principalAmount: number;
  interestAmount: number;
  lateFee: number;
  status: RepaymentStatus;
  amountPaid: number;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  autoDeducted: boolean;
  contributionId: string | null;
  ledgerTransactionId: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChamaLendingSettings {
  autoApproveEnabled: boolean;
  autoApproveMaxAmount: number;
  autoApproveMinReputationTier: string;
  defaultInterestRate: number;
  maxLoanAmount: number;
  minRepaymentPeriodMonths: number;
  maxRepaymentPeriodMonths: number;
  requiresVoteForAmountsAbove: number;
  gracePeriodDays: number;
  lateFeeRate: number;
  allowEarlyRepayment: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class LendingService {
  private readonly logger = new Logger(LendingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledgerService: LedgerService,
    private readonly reputationService: ReputationService,
    private readonly metrics: MetricsService,
  ) {}

  // ============================================================================
  // LOAN APPLICATION
  // ============================================================================

  /**
   * Create a new loan application
   */
  async createLoanApplication(
    applicantId: string,
    dto: CreateLoanApplicationDto,
  ): Promise<LoanApplication> {
    const { chamaId, amountRequested, purpose, proposedInterestRate, proposedRepaymentPeriodMonths, metadata } = dto;

    // Validate membership
    const memberResult = await this.db.query(
      `SELECT id, role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, applicantId],
    );

    if (memberResult.rows.length === 0) {
      throw new ForbiddenException('You must be an active member of this chama to apply for a loan');
    }

    // Check if lending is enabled for this chama
    const chamaResult = await this.db.query(
      `SELECT lending_enabled, lending_settings FROM chamas WHERE id = $1`,
      [chamaId],
    );

    const chama = mapQueryRow<{ lendingEnabled: boolean; lendingSettings: ChamaLendingSettings | null }>(
      chamaResult,
      { booleanFields: ['lendingEnabled'] },
    );

    if (!chama?.lendingEnabled) {
      throw new BadRequestException('Lending is not enabled for this chama');
    }

    const settings = chama.lendingSettings || this.getDefaultLendingSettings();

    // Validate amount
    if (amountRequested > settings.maxLoanAmount) {
      throw new BadRequestException(
        `Requested amount exceeds maximum loan amount of ${settings.maxLoanAmount}`,
      );
    }

    // Validate repayment period
    if (
      proposedRepaymentPeriodMonths < settings.minRepaymentPeriodMonths ||
      proposedRepaymentPeriodMonths > settings.maxRepaymentPeriodMonths
    ) {
      throw new BadRequestException(
        `Repayment period must be between ${settings.minRepaymentPeriodMonths} and ${settings.maxRepaymentPeriodMonths} months`,
      );
    }

    // Check for existing pending applications
    const existingResult = await this.db.query(
      `SELECT id FROM loan_applications 
       WHERE chama_id = $1 AND applicant_id = $2 
       AND status IN ('draft', 'submitted', 'under_review', 'pending_vote')`,
      [chamaId, applicantId],
    );

    if (existingResult.rows.length > 0) {
      throw new BadRequestException('You already have a pending loan application');
    }

    // Check for existing active loans
    const activeLoanResult = await this.db.query(
      `SELECT id FROM loans 
       WHERE chama_id = $1 AND borrower_id = $2 AND status = 'active'`,
      [chamaId, applicantId],
    );

    if (activeLoanResult.rows.length > 0) {
      throw new BadRequestException('You already have an active loan with this chama');
    }

    // Check loan eligibility via reputation service
    // Admins/treasurers can bypass strict eligibility for smaller amounts (useful for testing/bootstrap)
    const memberRole = mapQueryRow<{ role: string }>(memberResult)?.role;
    const isPrivilegedMember = memberRole === 'admin' || memberRole === 'treasurer';
    const bypassEligibility = isPrivilegedMember && amountRequested <= (settings.autoApproveMaxAmount || 10000);

    if (!bypassEligibility) {
      const eligibility = await this.reputationService.getLoanEligibility(
        applicantId,
        chamaId,
        amountRequested,
      );

      if (!eligibility.eligible) {
        throw new BadRequestException(`Loan eligibility check failed: ${eligibility.reason}`);
      }
    } else {
      this.logger.log(`Eligibility check bypassed for ${memberRole} requesting ${amountRequested}`);
    }

    // Determine if voting is required
    const requiresVote = amountRequested > settings.requiresVoteForAmountsAbove;

    // Set expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create application
    const result = await this.db.query(
      `INSERT INTO loan_applications (
        chama_id, applicant_id, amount_requested, purpose,
        proposed_interest_rate, proposed_repayment_period_months,
        status, requires_vote, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        chamaId,
        applicantId,
        amountRequested,
        purpose,
        proposedInterestRate || settings.defaultInterestRate,
        proposedRepaymentPeriodMonths,
        LoanApplicationStatus.SUBMITTED,
        requiresVote,
        expiresAt,
        JSON.stringify(metadata || {}),
      ],
    );

    const application = mapQueryRow<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });

    if (!application) {
      throw new BadRequestException('Failed to create loan application');
    }

    this.logger.log(`Loan application created: ${application.id} for ${amountRequested} by user ${applicantId}`);

    // Check for auto-approval
    if (settings.autoApproveEnabled && !requiresVote) {
      const canAutoApprove = await this.checkAutoApprovalEligibility(
        applicantId,
        chamaId,
        amountRequested,
        settings,
      );

      if (canAutoApprove) {
        return this.autoApproveLoan(application.id, settings);
      }
    }

    return application;
  }

  /**
   * Check if a loan can be auto-approved
   */
  private async checkAutoApprovalEligibility(
    applicantId: string,
    chamaId: string,
    amount: number,
    settings: ChamaLendingSettings,
  ): Promise<boolean> {
    if (amount > settings.autoApproveMaxAmount) {
      return false;
    }

    // Check reputation tier
    const reputation = await this.reputationService.getUserReputation(applicantId, chamaId);
    if (!reputation) {
      return false;
    }

    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const userTierIndex = tierOrder.indexOf(reputation.tier);
    const requiredTierIndex = tierOrder.indexOf(settings.autoApproveMinReputationTier);

    return userTierIndex >= requiredTierIndex;
  }

  /**
   * Auto-approve a loan application
   */
  private async autoApproveLoan(
    applicationId: string,
    settings: ChamaLendingSettings,
  ): Promise<LoanApplication> {
    const result = await this.db.query(
      `UPDATE loan_applications 
       SET status = $1, approval_method = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [LoanApplicationStatus.APPROVED, ApprovalMethod.AUTO_APPROVE, applicationId],
    );

    const application = mapQueryRow<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    this.logger.log(`Loan application auto-approved: ${applicationId}`);

    // Create the loan record
    await this.createLoanFromApplication(application, settings);

    return application;
  }

  /**
   * Manually approve a loan application (by treasurer/admin)
   */
  async approveLoanApplication(dto: ApproveLoanDto): Promise<LoanApplication> {
    const { applicationId, approvedBy, approvalMethod, finalInterestRate, finalRepaymentPeriodMonths, gracePeriodDays, repaymentFrequency } = dto;

    // Get application
    const appResult = await this.db.query(
      `SELECT la.*, c.lending_settings FROM loan_applications la
       JOIN chamas c ON la.chama_id = c.id
       WHERE la.id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Loan application not found');
    }

    const row = appResult.rows[0];
    const application = mapQueryRow<LoanApplication & { lendingSettings: ChamaLendingSettings }>(
      { rows: [row] },
      {
        numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
        booleanFields: ['requiresVote'],
        dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
      },
    );

    if (!application) {
      throw new NotFoundException('Loan application not found');
    }

    // Validate status
    if (application.status !== LoanApplicationStatus.SUBMITTED && application.status !== LoanApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot approve application with status: ${application.status}`);
    }

    // Validate approver is admin/treasurer
    const approverResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [application.chamaId, approvedBy],
    );

    const approverRole = mapQueryRow<{ role: string }>(approverResult)?.role;
    if (!approverRole || !['admin', 'treasurer'].includes(approverRole)) {
      throw new ForbiddenException('Only admin or treasurer can approve loans');
    }

    // Update application
    const result = await this.db.query(
      `UPDATE loan_applications 
       SET status = $1, approval_method = $2, approved_by = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [LoanApplicationStatus.APPROVED, approvalMethod, approvedBy, applicationId],
    );

    const updatedApplication = mapQueryRow<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedApplication) {
      throw new BadRequestException('Failed to approve application');
    }

    this.logger.log(`Loan application approved: ${applicationId} by ${approvedBy}`);

    // Create the loan record with custom terms if provided
    const settings = application.lendingSettings || this.getDefaultLendingSettings();
    await this.createLoanFromApplication(updatedApplication, settings, {
      interestRate: finalInterestRate,
      repaymentPeriodMonths: finalRepaymentPeriodMonths,
      gracePeriodDays,
      repaymentFrequency,
    });

    return updatedApplication;
  }

  /**
   * Reject a loan application
   */
  async rejectLoanApplication(dto: RejectLoanDto): Promise<LoanApplication> {
    const { applicationId, rejectedBy, reason } = dto;

    // Validate application exists
    const appResult = await this.db.query(
      `SELECT * FROM loan_applications WHERE id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Loan application not found');
    }

    const application = mapQueryRow<LoanApplication>(appResult, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
    });

    if (!application) {
      throw new NotFoundException('Loan application not found');
    }

    // Validate status
    if (!['submitted', 'under_review', 'pending_vote'].includes(application.status)) {
      throw new BadRequestException(`Cannot reject application with status: ${application.status}`);
    }

    // Validate rejector is admin/treasurer
    const rejectorResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [application.chamaId, rejectedBy],
    );

    const rejectorRole = mapQueryRow<{ role: string }>(rejectorResult)?.role;
    if (!rejectorRole || !['admin', 'treasurer'].includes(rejectorRole)) {
      throw new ForbiddenException('Only admin or treasurer can reject loans');
    }

    // Update application
    const result = await this.db.query(
      `UPDATE loan_applications 
       SET status = $1, rejected_by = $2, rejected_at = NOW(), rejection_reason = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [LoanApplicationStatus.REJECTED, rejectedBy, reason, applicationId],
    );

    const updatedApplication = mapQueryRow<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedApplication) {
      throw new BadRequestException('Failed to reject application');
    }

    this.logger.log(`Loan application rejected: ${applicationId} by ${rejectedBy}. Reason: ${reason}`);

    return updatedApplication;
  }

  /**
   * Withdraw a loan application (by applicant)
   */
  async withdrawLoanApplication(applicationId: string, userId: string): Promise<LoanApplication> {
    const appResult = await this.db.query(
      `SELECT * FROM loan_applications WHERE id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Loan application not found');
    }

    const application = mapQueryRow<LoanApplication>(appResult, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
    });

    if (!application) {
      throw new NotFoundException('Loan application not found');
    }

    // Validate ownership
    if (application.applicantId !== userId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }

    // Validate status
    if (!['draft', 'submitted', 'under_review'].includes(application.status)) {
      throw new BadRequestException(`Cannot withdraw application with status: ${application.status}`);
    }

    const result = await this.db.query(
      `UPDATE loan_applications 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [LoanApplicationStatus.WITHDRAWN, applicationId],
    );

    const updatedApplication = mapQueryRow<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedApplication) {
      throw new BadRequestException('Failed to withdraw application');
    }

    this.logger.log(`Loan application withdrawn: ${applicationId} by ${userId}`);

    return updatedApplication;
  }

  // ============================================================================
  // LOAN CREATION & DISBURSEMENT
  // ============================================================================

  /**
   * Create a loan record from an approved application
   */
  private async createLoanFromApplication(
    application: LoanApplication,
    settings: ChamaLendingSettings,
    overrides?: {
      interestRate?: number;
      repaymentPeriodMonths?: number;
      gracePeriodDays?: number;
      repaymentFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    },
  ): Promise<Loan> {
    const interestRate = overrides?.interestRate ?? application.proposedInterestRate ?? settings.defaultInterestRate;
    const repaymentPeriodMonths = overrides?.repaymentPeriodMonths ?? application.proposedRepaymentPeriodMonths;
    const gracePeriodDays = overrides?.gracePeriodDays ?? settings.gracePeriodDays;
    const repaymentFrequency = overrides?.repaymentFrequency ?? 'monthly';

    // Calculate total amount (principal + interest)
    const principal = application.amountRequested;
    const interest = this.calculateSimpleInterest(principal, interestRate, repaymentPeriodMonths);
    const totalAmount = principal + interest;

    // Calculate dates
    const firstPaymentDate = new Date();
    firstPaymentDate.setDate(firstPaymentDate.getDate() + gracePeriodDays + this.getDaysForFrequency(repaymentFrequency));

    const maturityDate = new Date(firstPaymentDate);
    maturityDate.setMonth(maturityDate.getMonth() + repaymentPeriodMonths);

    // Create loan
    const result = await this.db.query(
      `INSERT INTO loans (
        loan_application_id, chama_id, borrower_id,
        principal_amount, interest_rate, total_amount,
        repayment_period_months, repayment_frequency,
        first_payment_date, maturity_date, grace_period_days,
        status, outstanding_balance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        application.id,
        application.chamaId,
        application.applicantId,
        principal,
        interestRate,
        totalAmount,
        repaymentPeriodMonths,
        repaymentFrequency,
        firstPaymentDate,
        maturityDate,
        gracePeriodDays,
        LoanStatus.PENDING_DISBURSEMENT,
        totalAmount, // Outstanding balance starts as total amount
      ],
    );

    const loan = mapQueryRow<Loan>(result, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'totalInterestPaid',
        'totalPrincipalPaid', 'outstandingBalance', 'overdueAmount', 'lateFeePenalty',
        'collateralValue',
      ],
      dateFields: [
        'disbursedAt', 'firstPaymentDate', 'maturityDate', 'defaultedAt',
        'paidOffAt', 'agreementSignedAt', 'createdAt', 'updatedAt',
      ],
    });

    if (!loan) {
      throw new BadRequestException('Failed to create loan');
    }

    this.logger.log(`Loan created: ${loan.id} for ${principal} (total: ${totalAmount})`);

    // Generate repayment schedule
    await this.generateRepaymentSchedule(loan);

    return loan;
  }

  /**
   * Disburse a loan (transfer funds from chama to borrower)
   */
  async disburseLoan(loanId: string, disbursedBy: string): Promise<Loan> {
    const startTime = Date.now();
    const loanResult = await this.db.query(
      `SELECT * FROM loans WHERE id = $1`,
      [loanId],
    );

    if (loanResult.rows.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const loan = mapQueryRow<Loan>(loanResult, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'outstandingBalance',
      ],
      dateFields: ['disbursedAt', 'firstPaymentDate', 'maturityDate', 'createdAt', 'updatedAt'],
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Validate status
    if (loan.status !== LoanStatus.PENDING_DISBURSEMENT) {
      throw new BadRequestException(`Cannot disburse loan with status: ${loan.status}`);
    }

    // Validate disburser is admin/treasurer
    const disburserResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [loan.chamaId, disbursedBy],
    );

    const disburserRole = mapQueryRow<{ role: string }>(disburserResult)?.role;
    if (!disburserRole || !['admin', 'treasurer'].includes(disburserRole)) {
      throw new ForbiddenException('Only admin or treasurer can disburse loans');
    }

    // Process disbursement via ledger (chama wallet → borrower wallet)
    // Using processPayout which handles chama→user transfers
    const transactionRef = `LOAN-DISB-${loan.id.slice(0, 8)}`;
    
    try {
      await this.ledgerService.processPayout(
        loan.chamaId,
        loan.borrowerId,
        loan.principalAmount,
        `Loan disbursement: ${transactionRef}`,
        transactionRef,
      );
    } catch (error) {
      if (error instanceof BadRequestException && error.message.includes('Insufficient')) {
        throw new BadRequestException(
          `Insufficient chama balance for loan disbursement`,
        );
      }
      throw error;
    }

    // Update loan status
    const result = await this.db.query(
      `UPDATE loans 
       SET status = $1, disbursed_at = NOW(), amount_disbursed = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [LoanStatus.ACTIVE, loan.principalAmount, loanId],
    );

    const updatedLoan = mapQueryRow<Loan>(result, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'outstandingBalance',
      ],
      dateFields: ['disbursedAt', 'firstPaymentDate', 'maturityDate', 'createdAt', 'updatedAt'],
    });

    if (!updatedLoan) {
      throw new BadRequestException('Failed to update loan status');
    }

    this.logger.log(`Loan disbursed: ${loanId} - ${loan.principalAmount} to user ${loan.borrowerId}`);

    const duration = Date.now() - startTime;
    this.metrics.recordLendingOperation('disburse_loan', 'success', duration);
    return updatedLoan;
  }

  // ============================================================================
  // REPAYMENT
  // ============================================================================

  /**
   * Generate repayment schedule for a loan
   */
  private async generateRepaymentSchedule(loan: Loan): Promise<void> {
    const { id: loanId, totalAmount, principalAmount, interestRate, repaymentPeriodMonths, repaymentFrequency, firstPaymentDate } = loan;

    const numberOfPayments = this.calculateNumberOfPayments(repaymentPeriodMonths, repaymentFrequency);
    const installmentAmount = totalAmount / numberOfPayments;
    const principalPerInstallment = principalAmount / numberOfPayments;
    const interestPerInstallment = (totalAmount - principalAmount) / numberOfPayments;

    const dueDate = new Date(firstPaymentDate);

    for (let i = 1; i <= numberOfPayments; i++) {
      await this.db.query(
        `INSERT INTO loan_repayments (
          loan_id, installment_number, due_date, amount_due,
          principal_amount, interest_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          loanId,
          i,
          dueDate,
          installmentAmount,
          principalPerInstallment,
          interestPerInstallment,
          RepaymentStatus.PENDING,
        ],
      );

      // Advance due date based on frequency
      this.advanceDateByFrequency(dueDate, repaymentFrequency);
    }

    this.logger.log(`Generated ${numberOfPayments} repayment installments for loan ${loanId}`);
  }

  /**
   * Make a loan repayment
   */
  async makeRepayment(userId: string, dto: MakeRepaymentDto): Promise<LoanRepayment> {
    const startTime = Date.now();
    const { loanId, amount, paymentMethod, paymentReference, notes } = dto;

    // Get loan and validate
    const loanResult = await this.db.query(
      `SELECT * FROM loans WHERE id = $1`,
      [loanId],
    );

    if (loanResult.rows.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const loan = mapQueryRow<Loan>(loanResult, {
      numberFields: ['principalAmount', 'totalAmount', 'outstandingBalance', 'totalPaid'],
      dateFields: ['disbursedAt', 'createdAt', 'updatedAt'],
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Validate borrower
    if (loan.borrowerId !== userId) {
      throw new ForbiddenException('You can only make repayments on your own loans');
    }

    // Validate loan is active
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot make repayment on loan with status: ${loan.status}`);
    }

    // Get next pending repayment
    const repaymentResult = await this.db.query(
      `SELECT * FROM loan_repayments 
       WHERE loan_id = $1 AND status IN ('pending', 'overdue', 'partial')
       ORDER BY installment_number ASC
       LIMIT 1`,
      [loanId],
    );

    if (repaymentResult.rows.length === 0) {
      throw new BadRequestException('No pending repayments found');
    }

    const repayment = mapQueryRow<LoanRepayment>(repaymentResult, {
      numberFields: ['installmentNumber', 'amountDue', 'principalAmount', 'interestAmount', 'lateFee', 'amountPaid'],
      booleanFields: ['autoDeducted'],
      dateFields: ['dueDate', 'paidAt', 'createdAt', 'updatedAt'],
    });

    if (!repayment) {
      throw new NotFoundException('Repayment not found');
    }

    const amountDue = repayment.amountDue - repayment.amountPaid;

    // Validate payment amount
    if (amount > amountDue && !this.getChamaLendingSettings(loan.chamaId)) {
      // Early repayment - allow overpayment if enabled
      throw new BadRequestException(`Payment amount ${amount} exceeds amount due ${amountDue}`);
    }

    // Process payment via wallet
    if (paymentMethod === 'wallet') {
      // Transfer from user wallet to chama wallet using processContribution
      // (similar mechanics to a contribution - user pays chama)
      const transactionRef = `LOAN-PAY-${repayment.id.slice(0, 8)}`;
      
      try {
        await this.ledgerService.processContribution(
          userId,
          loan.chamaId,
          amount,
          `Loan repayment installment #${repayment.installmentNumber}: ${transactionRef}`,
          transactionRef,
        );
      } catch (error) {
        if (error instanceof BadRequestException && error.message.includes('Insufficient')) {
          throw new BadRequestException(
            `Insufficient wallet balance for loan repayment`,
          );
        }
        throw error;
      }
    }

    // Update repayment record
    const newAmountPaid = repayment.amountPaid + amount;
    const newStatus = newAmountPaid >= repayment.amountDue ? RepaymentStatus.PAID : RepaymentStatus.PARTIAL;

    const updateResult = await this.db.query(
      `UPDATE loan_repayments 
       SET status = $1, amount_paid = $2, paid_at = NOW(), 
           payment_method = $3, payment_reference = $4, notes = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [newStatus, newAmountPaid, paymentMethod, paymentReference, notes, repayment.id],
    );

    const updatedRepayment = mapQueryRow<LoanRepayment>(updateResult, {
      numberFields: ['installmentNumber', 'amountDue', 'principalAmount', 'interestAmount', 'lateFee', 'amountPaid'],
      booleanFields: ['autoDeducted'],
      dateFields: ['dueDate', 'paidAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedRepayment) {
      throw new BadRequestException('Failed to update repayment');
    }

    // Update loan totals
    await this.db.query(
      `UPDATE loans 
       SET total_paid = total_paid + $1, 
           total_principal_paid = total_principal_paid + $2,
           total_interest_paid = total_interest_paid + $3,
           outstanding_balance = outstanding_balance - $1,
           updated_at = NOW()
       WHERE id = $4`,
      [
        amount,
        Math.min(amount, repayment.principalAmount),
        Math.max(0, amount - repayment.principalAmount),
        loanId,
      ],
    );

    // Check if loan is fully paid
    const updatedLoanResult = await this.db.query(
      `SELECT outstanding_balance FROM loans WHERE id = $1`,
      [loanId],
    );

    const updatedLoan = mapQueryRow<{ outstandingBalance: number }>(updatedLoanResult, {
      numberFields: ['outstandingBalance'],
    });

    if (updatedLoan && updatedLoan.outstandingBalance <= 0) {
      await this.db.query(
        `UPDATE loans SET status = $1, paid_off_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [LoanStatus.PAID_OFF, loanId],
      );

      this.logger.log(`Loan fully paid off: ${loanId}`);
    }

    this.logger.log(`Loan repayment made: ${amount} for loan ${loanId}`);

    const duration = Date.now() - startTime;
    this.metrics.recordLendingOperation('make_repayment', 'success', duration);
    return updatedRepayment;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get loan applications for a chama
   */
  async getChamaLoanApplications(
    chamaId: string,
    status?: LoanApplicationStatus,
    limit = 50,
    offset = 0,
  ): Promise<LoanApplication[]> {
    let query = `
      SELECT la.*, u.full_name, u.email
      FROM loan_applications la
      JOIN users u ON la.applicant_id = u.id
      WHERE la.chama_id = $1
    `;
    const params: any[] = [chamaId];

    if (status) {
      query += ` AND la.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY la.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get user's loan applications
   */
  async getUserLoanApplications(
    userId: string,
    chamaId?: string,
  ): Promise<LoanApplication[]> {
    let query = `
      SELECT la.*, c.name as chama_name
      FROM loan_applications la
      JOIN chamas c ON la.chama_id = c.id
      WHERE la.applicant_id = $1
    `;
    const params: any[] = [userId];

    if (chamaId) {
      query += ` AND la.chama_id = $2`;
      params.push(chamaId);
    }

    query += ` ORDER BY la.created_at DESC`;

    const result = await this.db.query(query, params);

    return mapQueryResult<LoanApplication>(result, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVote'],
      dateFields: ['approvedAt', 'rejectedAt', 'expiresAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get loans for a chama
   */
  async getChamaLoans(
    chamaId: string,
    status?: LoanStatus,
    limit = 50,
    offset = 0,
  ): Promise<Loan[]> {
    let query = `
      SELECT l.*, u.full_name, u.email
      FROM loans l
      JOIN users u ON l.borrower_id = u.id
      WHERE l.chama_id = $1
    `;
    const params: any[] = [chamaId];

    if (status) {
      query += ` AND l.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<Loan>(result, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'totalInterestPaid',
        'totalPrincipalPaid', 'outstandingBalance', 'overdueAmount', 'lateFeePenalty',
      ],
      dateFields: [
        'disbursedAt', 'firstPaymentDate', 'maturityDate', 'defaultedAt',
        'paidOffAt', 'agreementSignedAt', 'createdAt', 'updatedAt',
      ],
    });
  }

  /**
   * Get user's loans
   */
  async getUserLoans(userId: string, chamaId?: string): Promise<Loan[]> {
    let query = `
      SELECT l.*, c.name as chama_name
      FROM loans l
      JOIN chamas c ON l.chama_id = c.id
      WHERE l.borrower_id = $1
    `;
    const params: any[] = [userId];

    if (chamaId) {
      query += ` AND l.chama_id = $2`;
      params.push(chamaId);
    }

    query += ` ORDER BY l.created_at DESC`;

    const result = await this.db.query(query, params);

    return mapQueryResult<Loan>(result, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'outstandingBalance',
      ],
      dateFields: ['disbursedAt', 'firstPaymentDate', 'maturityDate', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get loan details with repayment schedule
   */
  async getLoanDetails(loanId: string): Promise<{ loan: Loan; repayments: LoanRepayment[] }> {
    const loanResult = await this.db.query(
      `SELECT l.*, c.name as chama_name, u.full_name
       FROM loans l
       JOIN chamas c ON l.chama_id = c.id
       JOIN users u ON l.borrower_id = u.id
       WHERE l.id = $1`,
      [loanId],
    );

    if (loanResult.rows.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const loan = mapQueryRow<Loan>(loanResult, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'totalInterestPaid',
        'totalPrincipalPaid', 'outstandingBalance', 'overdueAmount', 'lateFeePenalty',
      ],
      dateFields: [
        'disbursedAt', 'firstPaymentDate', 'maturityDate', 'defaultedAt',
        'paidOffAt', 'agreementSignedAt', 'createdAt', 'updatedAt',
      ],
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const repaymentsResult = await this.db.query(
      `SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY installment_number ASC`,
      [loanId],
    );

    const repayments = mapQueryResult<LoanRepayment>(repaymentsResult, {
      numberFields: ['installmentNumber', 'amountDue', 'principalAmount', 'interestAmount', 'lateFee', 'amountPaid'],
      booleanFields: ['autoDeducted'],
      dateFields: ['dueDate', 'paidAt', 'createdAt', 'updatedAt'],
    });

    return { loan, repayments };
  }

  /**
   * Get chama lending summary
   */
  async getChamaLendingSummary(chamaId: string): Promise<{
    totalLoansIssued: number;
    activeLoans: number;
    overdueLoans: number;
    totalLent: number;
    totalRecovered: number;
    outstandingPortfolio: number;
    defaultedAmount: number;
    defaultRate: number;
    pendingApplications: number;
  }> {
    // Direct query instead of function to avoid dependency issues
    const result = await this.db.query(
      `SELECT 
        COUNT(*)::INTEGER as total_loans_issued,
        COUNT(*) FILTER (WHERE status = 'active')::INTEGER as active_loans,
        COUNT(*) FILTER (WHERE status = 'overdue')::INTEGER as overdue_loans,
        COALESCE(SUM(amount_disbursed), 0)::DECIMAL as total_lent,
        COALESCE(SUM(total_paid), 0)::DECIMAL as total_recovered,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE status = 'active'), 0)::DECIMAL as outstanding_portfolio,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE status = 'defaulted'), 0)::DECIMAL as defaulted_amount,
        CASE 
          WHEN COUNT(*) > 0 
          THEN (COUNT(*) FILTER (WHERE status = 'defaulted')::DECIMAL / COUNT(*)::DECIMAL * 100)
          ELSE 0
        END as default_rate
       FROM loans
       WHERE chama_id = $1`,
      [chamaId],
    );

    const summary = mapQueryRow<{
      totalLoansIssued: number;
      activeLoans: number;
      overdueLoans: number;
      totalLent: number;
      totalRecovered: number;
      outstandingPortfolio: number;
      defaultedAmount: number;
      defaultRate: number;
    }>(result, {
      numberFields: [
        'totalLoansIssued', 'activeLoans', 'overdueLoans', 'totalLent', 'totalRecovered',
        'outstandingPortfolio', 'defaultedAmount', 'defaultRate',
      ],
    });

    // Get pending applications count
    const pendingResult = await this.db.query(
      `SELECT COUNT(*) as count FROM loan_applications 
       WHERE chama_id = $1 AND status IN ('submitted', 'under_review', 'pending_vote')`,
      [chamaId],
    );

    const pendingApplications = parseInt(pendingResult.rows[0]?.count || '0');

    return {
      totalLoansIssued: summary?.totalLoansIssued || 0,
      activeLoans: summary?.activeLoans || 0,
      overdueLoans: summary?.overdueLoans || 0,
      totalLent: summary?.totalLent || 0,
      totalRecovered: summary?.totalRecovered || 0,
      outstandingPortfolio: summary?.outstandingPortfolio || 0,
      defaultedAmount: summary?.defaultedAmount || 0,
      defaultRate: summary?.defaultRate || 0,
      pendingApplications,
    };
  }

  /**
   * Get total interest income from loans for a chama
   */
  async getChamaInterestIncome(chamaId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(total_interest_paid), 0)::DECIMAL as total_interest_income
       FROM loans
       WHERE chama_id = $1`,
      [chamaId],
    );

    return parseFloat(result.rows[0]?.total_interest_income || '0');
  }

  /**
   * Get recent lending activities for a chama
   */
  async getChamaRecentActivities(chamaId: string, limit = 10): Promise<any[]> {
    const activities: any[] = [];

    // Get recent loan repayments (payments received)
    const repaymentsResult = await this.db.query(
      `SELECT 
        lr.id,
        lr.loan_id,
        lr.amount_paid,
        lr.paid_at,
        lr.status,
        l.id as loan_id_full,
        u.full_name as borrower_name
       FROM loan_repayments lr
       JOIN loans l ON lr.loan_id = l.id
       JOIN users u ON l.borrower_id = u.id
       WHERE l.chama_id = $1 
         AND lr.status = 'paid'
         AND lr.paid_at IS NOT NULL
       ORDER BY lr.paid_at DESC
       LIMIT $2`,
      [chamaId, limit],
    );

    repaymentsResult.rows.forEach((row: any) => {
      activities.push({
        type: 'payment',
        id: row.id,
        loanId: row.loan_id,
        borrowerName: row.borrower_name,
        amount: parseFloat(row.amount_paid || '0'),
        timestamp: row.paid_at,
        createdAt: row.paid_at,
      });
    });

    // Get recent loan applications (approved)
    const applicationsResult = await this.db.query(
      `SELECT 
        la.id,
        la.amount_requested,
        la.status,
        la.approved_at,
        u.full_name as applicant_name
       FROM loan_applications la
       JOIN users u ON la.applicant_id = u.id
       WHERE la.chama_id = $1 
         AND la.status = 'approved'
         AND la.approved_at IS NOT NULL
       ORDER BY la.approved_at DESC
       LIMIT $2`,
      [chamaId, limit],
    );

    applicationsResult.rows.forEach((row: any) => {
      activities.push({
        type: 'application',
        id: row.id,
        applicantName: row.applicant_name,
        amount: parseFloat(row.amount_requested || '0'),
        timestamp: row.approved_at,
        createdAt: row.approved_at,
      });
    });

    // Get recent loan disbursements
    const disbursementsResult = await this.db.query(
      `SELECT 
        l.id,
        l.amount_disbursed,
        l.disbursed_at,
        u.full_name as borrower_name
       FROM loans l
       JOIN users u ON l.borrower_id = u.id
       WHERE l.chama_id = $1 
         AND l.disbursed_at IS NOT NULL
       ORDER BY l.disbursed_at DESC
       LIMIT $2`,
      [chamaId, limit],
    );

    disbursementsResult.rows.forEach((row: any) => {
      activities.push({
        type: 'disbursement',
        id: row.id,
        borrowerName: row.borrower_name,
        amount: parseFloat(row.amount_disbursed || '0'),
        timestamp: row.disbursed_at,
        createdAt: row.disbursed_at,
      });
    });

    // Get overdue repayments
    const overdueResult = await this.db.query(
      `SELECT 
        lr.id,
        lr.loan_id,
        lr.amount_due,
        lr.due_date,
        l.id as loan_id_full,
        u.full_name as borrower_name
       FROM loan_repayments lr
       JOIN loans l ON lr.loan_id = l.id
       JOIN users u ON l.borrower_id = u.id
       WHERE l.chama_id = $1 
         AND lr.status = 'overdue'
         AND lr.due_date < NOW()
       ORDER BY lr.due_date DESC
       LIMIT $2`,
      [chamaId, limit],
    );

    overdueResult.rows.forEach((row: any) => {
      activities.push({
        type: 'overdue',
        id: row.id,
        loanId: row.loan_id,
        borrowerName: row.borrower_name,
        amount: parseFloat(row.amount_due || '0'),
        timestamp: row.due_date,
        createdAt: row.due_date,
      });
    });

    // Get recent contributions
    const contributionsResult = await this.db.query(
      `SELECT 
        c.id,
        c.amount,
        c.contributed_at,
        c.status,
        u.full_name as contributor_name
       FROM contributions c
       JOIN users u ON c.user_id = u.id
       WHERE c.chama_id = $1 
         AND c.status = 'completed'
         AND c.contributed_at IS NOT NULL
       ORDER BY c.contributed_at DESC
       LIMIT $2`,
      [chamaId, limit],
    );

    contributionsResult.rows.forEach((row: any) => {
      activities.push({
        type: 'contribution',
        id: row.id,
        contributorName: row.contributor_name,
        amount: parseFloat(row.amount || '0'),
        timestamp: row.contributed_at,
        createdAt: row.contributed_at,
      });
    });

    // Sort all activities by timestamp (most recent first) and limit
    activities.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return activities.slice(0, limit);
  }

  /**
   * Get all repayments for a chama (for Payments tab)
   */
  async getChamaRepayments(
    chamaId: string,
    status?: RepaymentStatus,
    limit = 100,
    offset = 0,
  ): Promise<any[]> {
    let query = `
      SELECT 
        lr.*,
        l.id as loan_id_full,
        l.borrower_id,
        u.full_name as borrower_name,
        l.principal_amount,
        l.total_amount as loan_total_amount
       FROM loan_repayments lr
       JOIN loans l ON lr.loan_id = l.id
       JOIN users u ON l.borrower_id = u.id
       WHERE l.chama_id = $1
    `;
    const params: any[] = [chamaId];

    if (status) {
      query += ` AND lr.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY lr.due_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<any>(result, {
      numberFields: [
        'installmentNumber', 'amountDue', 'principalAmount', 'interestAmount',
        'lateFee', 'amountPaid',
      ],
      dateFields: ['dueDate', 'paidAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get analytics data for a chama
   */
  async getChamaAnalytics(chamaId: string): Promise<any> {
    const summary = await this.getChamaLendingSummary(chamaId);

    // Get loan status breakdown
    const statusBreakdown = await this.db.query(
      `SELECT 
        status,
        COUNT(*)::INTEGER as count,
        COALESCE(SUM(amount_disbursed), 0)::DECIMAL as total_amount
       FROM loans
       WHERE chama_id = $1
       GROUP BY status`,
      [chamaId],
    );

    // Get monthly interest income (last 12 months)
    const monthlyInterest = await this.db.query(
      `SELECT 
        DATE_TRUNC('month', lr.paid_at) as month,
        COALESCE(SUM(lr.interest_amount), 0)::DECIMAL as interest_income
       FROM loan_repayments lr
       JOIN loans l ON lr.loan_id = l.id
       WHERE l.chama_id = $1 
         AND lr.status = 'paid'
         AND lr.paid_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', lr.paid_at)
       ORDER BY month DESC
       LIMIT 12`,
      [chamaId],
    );

    // Get monthly loan disbursements (last 12 months)
    const monthlyDisbursements = await this.db.query(
      `SELECT 
        DATE_TRUNC('month', disbursed_at) as month,
        COUNT(*)::INTEGER as loan_count,
        COALESCE(SUM(amount_disbursed), 0)::DECIMAL as total_disbursed
       FROM loans
       WHERE chama_id = $1 
         AND disbursed_at >= NOW() - INTERVAL '12 months'
         AND disbursed_at IS NOT NULL
       GROUP BY DATE_TRUNC('month', disbursed_at)
       ORDER BY month DESC
       LIMIT 12`,
      [chamaId],
    );

    return {
      summary,
      statusBreakdown: statusBreakdown.rows,
      monthlyInterest: monthlyInterest.rows,
      monthlyDisbursements: monthlyDisbursements.rows,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getDefaultLendingSettings(): ChamaLendingSettings {
    return {
      autoApproveEnabled: false,
      autoApproveMaxAmount: 10000,
      autoApproveMinReputationTier: 'silver',
      defaultInterestRate: 10, // 10%
      maxLoanAmount: 100000,
      minRepaymentPeriodMonths: 1,
      maxRepaymentPeriodMonths: 12,
      requiresVoteForAmountsAbove: 50000,
      gracePeriodDays: 7,
      lateFeeRate: 5, // 5% late fee
      allowEarlyRepayment: true,
    };
  }

  private async getChamaLendingSettings(chamaId: string): Promise<ChamaLendingSettings | null> {
    const result = await this.db.query(
      `SELECT lending_settings FROM chamas WHERE id = $1`,
      [chamaId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].lending_settings || this.getDefaultLendingSettings();
  }

  private calculateSimpleInterest(principal: number, rate: number, months: number): number {
    return principal * (rate / 100) * (months / 12);
  }

  private calculateNumberOfPayments(months: number, frequency: string): number {
    switch (frequency) {
      case 'daily':
        return months * 30; // Approximately 30 days per month
      case 'weekly':
        return months * 4; // Approximately 4 weeks per month
      case 'biweekly':
        return months * 2;
      case 'monthly':
      default:
        return months;
    }
  }

  private getDaysForFrequency(frequency: string): number {
    switch (frequency) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'biweekly':
        return 14;
      case 'monthly':
      default:
        return 30;
    }
  }

  private advanceDateByFrequency(date: Date, frequency: string): void {
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
      default:
        date.setMonth(date.getMonth() + 1);
        break;
    }
  }

  // ============================================================================
  // LOAN PAYMENT REMINDERS
  // ============================================================================

  /**
   * Get loan payment reminders for a user
   */
  async getUserLoanReminders(
    userId: string,
    status?: string,
    limit = 20,
  ): Promise<any[]> {
    let query = `
      SELECT 
        r.*,
        l.id as loan_id,
        l.chama_id,
        l.outstanding_balance,
        lr.installment_number,
        lr.due_date,
        lr.amount_due,
        lr.amount_paid,
        lr.status as repayment_status,
        ch.name as chama_name
      FROM loan_repayment_reminders r
      JOIN loans l ON r.loan_id = l.id
      JOIN loan_repayments lr ON r.repayment_id = lr.id
      JOIN chamas ch ON l.chama_id = ch.id
      WHERE r.borrower_id = $1
        AND l.status = 'active'
    `;
    const params: any[] = [userId];

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY r.scheduled_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.db.query(query, params);

    return mapQueryResult<any>(result, {
      numberFields: [
        'daysOffset',
        'outstandingBalance',
        'installmentNumber',
        'amountDue',
        'amountPaid',
      ],
      dateFields: ['dueDate', 'scheduledAt', 'sentAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get reminders for a specific loan
   */
  async getLoanReminders(loanId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT 
        r.*,
        lr.installment_number,
        lr.due_date,
        lr.amount_due,
        lr.amount_paid,
        lr.status as repayment_status
      FROM loan_repayment_reminders r
      JOIN loan_repayments lr ON r.repayment_id = lr.id
      WHERE r.loan_id = $1
      ORDER BY r.scheduled_at DESC`,
      [loanId],
    );

    return mapQueryResult<any>(result, {
      numberFields: [
        'daysOffset',
        'installmentNumber',
        'amountDue',
        'amountPaid',
      ],
      dateFields: ['dueDate', 'scheduledAt', 'sentAt', 'createdAt', 'updatedAt'],
    });
  }
}

