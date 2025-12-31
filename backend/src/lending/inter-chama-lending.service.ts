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
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum InterChamaRequestStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  NEGOTIATING = 'negotiating',
  PENDING_VOTE_REQUESTING = 'pending_vote_requesting',
  PENDING_VOTE_LENDING = 'pending_vote_lending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

export enum InterChamaLoanStatus {
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

export interface CreateInterChamaRequestDto {
  requestingChamaId: string;
  lendingChamaId: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate?: number;
  proposedRepaymentPeriodMonths: number;
  proposedCollateral?: string;
  collateralValue?: number;
}

export interface NegotiateTermsDto {
  requestId: string;
  finalInterestRate?: number;
  finalRepaymentPeriodMonths?: number;
  finalCollateral?: string;
  finalCollateralValue?: number;
  notes?: string;
}

export interface ApproveInterChamaRequestDto {
  requestId: string;
  approvedBy: string;
  side: 'requesting' | 'lending';
  finalInterestRate?: number;
  finalRepaymentPeriodMonths?: number;
}

export interface RejectInterChamaRequestDto {
  requestId: string;
  rejectedBy: string;
  side: 'requesting' | 'lending';
  reason: string;
}

export interface MakeInterChamaRepaymentDto {
  loanId: string;
  amount: number;
  paymentReference?: string;
  notes?: string;
}

export interface InterChamaLoanRequest {
  id: string;
  requestingChamaId: string;
  lendingChamaId: string;
  createdBy: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate: number | null;
  proposedRepaymentPeriodMonths: number;
  proposedCollateral: string | null;
  collateralValue: number | null;
  status: InterChamaRequestStatus;
  finalInterestRate: number | null;
  finalRepaymentPeriodMonths: number | null;
  finalCollateral: string | null;
  finalCollateralValue: number | null;
  approvedByRequestingChama: string | null;
  approvedAtRequestingChama: Date | null;
  approvedByLendingChama: string | null;
  approvedAtLendingChama: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  rejectedBySide: string | null;
  requiresVoteRequesting: boolean;
  voteProposalIdRequesting: string | null;
  requiresVoteLending: boolean;
  voteProposalIdLending: string | null;
  requestingChamaReputationTier: string | null;
  requestingChamaReputationScore: number | null;
  lendingChamaReputationTier: string | null;
  lendingChamaReputationScore: number | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface InterChamaLoan {
  id: string;
  loanRequestId: string;
  requestingChamaId: string;
  lendingChamaId: string;
  principalAmount: number;
  interestRate: number;
  totalAmount: number;
  repaymentPeriodMonths: number;
  repaymentFrequency: string;
  disbursedAt: Date | null;
  firstPaymentDate: Date;
  maturityDate: Date;
  gracePeriodDays: number;
  status: InterChamaLoanStatus;
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
  collateralDescription: string | null;
  collateralValue: number | null;
  collateralMetadata: Record<string, any> | null;
  agreementDocumentId: string | null;
  agreementSignedAt: Date | null;
  signedByRequesting: string | null;
  signedByLending: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class InterChamaLendingService {
  private readonly logger = new Logger(InterChamaLendingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledgerService: LedgerService,
    private readonly reputationService: ReputationService,
  ) {}

  // ============================================================================
  // LOAN REQUESTS
  // ============================================================================

  /**
   * Create an inter-chama loan request
   */
  async createLoanRequest(
    createdBy: string,
    dto: CreateInterChamaRequestDto,
  ): Promise<InterChamaLoanRequest> {
    const {
      requestingChamaId,
      lendingChamaId,
      amountRequested,
      purpose,
      proposedInterestRate,
      proposedRepaymentPeriodMonths,
      proposedCollateral,
      collateralValue,
    } = dto;

    // Validate chamas are different
    if (requestingChamaId === lendingChamaId) {
      throw new BadRequestException('Requesting and lending chamas must be different');
    }

    // Validate creator is admin/treasurer of requesting chama
    const creatorResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [requestingChamaId, createdBy],
    );

    if (creatorResult.rows.length === 0) {
      throw new ForbiddenException('You must be an active member of the requesting chama');
    }

    const creatorRole = mapQueryRow<{ role: string }>(creatorResult)?.role;
    if (!creatorRole || !['admin', 'treasurer'].includes(creatorRole)) {
      throw new ForbiddenException('Only admin or treasurer can create loan requests');
    }

    // Check if inter-chama lending is enabled for both chamas
    const chamasResult = await this.db.query(
      `SELECT id, name, inter_chama_lending_enabled, inter_chama_lending_settings
       FROM chamas 
       WHERE id IN ($1, $2)`,
      [requestingChamaId, lendingChamaId],
    );

    const chamas = mapQueryResult<{
      id: string;
      name: string;
      interChamaLendingEnabled: boolean;
      interChamaLendingSettings: Record<string, any> | null;
    }>(chamasResult, {
      booleanFields: ['interChamaLendingEnabled'],
    });

    const requestingChama = chamas.find((c) => c.id === requestingChamaId);
    const lendingChama = chamas.find((c) => c.id === lendingChamaId);

    if (!requestingChama || !lendingChama) {
      throw new NotFoundException('One or both chamas not found');
    }

    if (!requestingChama.interChamaLendingEnabled) {
      throw new BadRequestException('Inter-chama lending is not enabled for the requesting chama');
    }

    if (!lendingChama.interChamaLendingEnabled) {
      throw new BadRequestException('Inter-chama lending is not enabled for the lending chama');
    }

    // Get chama reputation scores (for eligibility)
    const requestingReputation = await this.getChamaReputation(requestingChamaId);
    const lendingReputation = await this.getChamaReputation(lendingChamaId);

    // Validate amount against settings
    const requestingSettings = requestingChama.interChamaLendingSettings || {};
    const lendingSettings = lendingChama.interChamaLendingSettings || {};

    const minAmount = Math.max(
      requestingSettings.minLoanAmount || 50000,
      lendingSettings.minLoanAmount || 50000,
    );
    const maxAmount = Math.min(
      requestingSettings.maxLoanAmount || 1000000,
      lendingSettings.maxLoanAmount || 1000000,
    );

    if (amountRequested < minAmount || amountRequested > maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${minAmount} and ${maxAmount}`,
      );
    }

    // Validate repayment period
    const minPeriod = Math.max(
      requestingSettings.minRepaymentPeriodMonths || 3,
      lendingSettings.minRepaymentPeriodMonths || 3,
    );
    const maxPeriod = Math.min(
      requestingSettings.maxRepaymentPeriodMonths || 24,
      lendingSettings.maxRepaymentPeriodMonths || 24,
    );

    if (
      proposedRepaymentPeriodMonths < minPeriod ||
      proposedRepaymentPeriodMonths > maxPeriod
    ) {
      throw new BadRequestException(
        `Repayment period must be between ${minPeriod} and ${maxPeriod} months`,
      );
    }

    // Check if voting is required
    const requiresVoteRequesting =
      amountRequested > (requestingSettings.requiresVoteForAmountsAbove || 200000);
    const requiresVoteLending =
      amountRequested > (lendingSettings.requiresVoteForAmountsAbove || 200000);

    // Set expiration (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create request
    const result = await this.db.query(
      `INSERT INTO inter_chama_loan_requests (
        requesting_chama_id, lending_chama_id, created_by,
        amount_requested, purpose, proposed_interest_rate, proposed_repayment_period_months,
        proposed_collateral, collateral_value,
        status, requires_vote_requesting, requires_vote_lending,
        requesting_chama_reputation_tier, requesting_chama_reputation_score,
        lending_chama_reputation_tier, lending_chama_reputation_score,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        requestingChamaId,
        lendingChamaId,
        createdBy,
        amountRequested,
        purpose,
        proposedInterestRate || requestingSettings.defaultInterestRate || 8,
        proposedRepaymentPeriodMonths,
        proposedCollateral || null,
        collateralValue || null,
        InterChamaRequestStatus.SUBMITTED,
        requiresVoteRequesting,
        requiresVoteLending,
        requestingReputation?.tier || null,
        requestingReputation?.score || null,
        lendingReputation?.tier || null,
        lendingReputation?.score || null,
        expiresAt,
      ],
    );

    const request = mapQueryRow<InterChamaLoanRequest>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'collateralValue', 'finalInterestRate', 'finalRepaymentPeriodMonths',
        'finalCollateralValue', 'requestingChamaReputationScore', 'lendingChamaReputationScore',
      ],
      booleanFields: ['requiresVoteRequesting', 'requiresVoteLending'],
      dateFields: [
        'approvedAtRequestingChama', 'approvedAtLendingChama',
        'rejectedAt', 'createdAt', 'updatedAt', 'expiresAt',
      ],
    });

    if (!request) {
      throw new BadRequestException('Failed to create loan request');
    }

    this.logger.log(
      `Inter-chama loan request created: ${request.id} - ${requestingChamaId} -> ${lendingChamaId} for ${amountRequested}`,
    );

    return request;
  }

  /**
   * Get chama reputation (aggregate of member reputations)
   */
  private async getChamaReputation(chamaId: string): Promise<{
    tier: string;
    score: number;
  } | null> {
    try {
      // Get average reputation score for chama members
      const result = await this.db.query(
        `SELECT 
          AVG(total_score)::INTEGER as avg_score,
          MODE() WITHIN GROUP (ORDER BY tier) as most_common_tier
         FROM reputation_scores
         WHERE chama_id = $1`,
        [chamaId],
      );

      if (result.rows.length === 0 || !result.rows[0].avg_score) {
        return null;
      }

      return {
        tier: result.rows[0].most_common_tier || 'bronze',
        score: result.rows[0].avg_score,
      };
    } catch (error) {
      this.logger.warn(`Failed to get chama reputation: ${error}`);
      return null;
    }
  }

  /**
   * Negotiate terms for a loan request
   */
  async negotiateTerms(dto: NegotiateTermsDto): Promise<InterChamaLoanRequest> {
    const { requestId, finalInterestRate, finalRepaymentPeriodMonths, finalCollateral, finalCollateralValue, notes } = dto;

    // Get request
    const requestResult = await this.db.query(
      `SELECT * FROM inter_chama_loan_requests WHERE id = $1`,
      [requestId],
    );

    if (requestResult.rows.length === 0) {
      throw new NotFoundException('Loan request not found');
    }

    const request = mapQueryRow<InterChamaLoanRequest>(requestResult, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
    });

    if (!request) {
      throw new NotFoundException('Loan request not found');
    }

    // Validate status allows negotiation
    if (!['submitted', 'under_review', 'negotiating'].includes(request.status)) {
      throw new BadRequestException(`Cannot negotiate request with status: ${request.status}`);
    }

    // Update request with negotiated terms
    const result = await this.db.query(
      `UPDATE inter_chama_loan_requests 
       SET status = $1, final_interest_rate = $2, final_repayment_period_months = $3,
           final_collateral = $4, final_collateral_value = $5, metadata = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        InterChamaRequestStatus.NEGOTIATING,
        finalInterestRate || request.proposedInterestRate,
        finalRepaymentPeriodMonths || request.proposedRepaymentPeriodMonths,
        finalCollateral || request.proposedCollateral,
        finalCollateralValue || request.collateralValue,
        JSON.stringify({ negotiationNotes: notes, ...request.metadata }),
        requestId,
      ],
    );

    const updatedRequest = mapQueryRow<InterChamaLoanRequest>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'finalInterestRate', 'finalRepaymentPeriodMonths', 'collateralValue', 'finalCollateralValue',
      ],
      booleanFields: ['requiresVoteRequesting', 'requiresVoteLending'],
      dateFields: ['approvedAtRequestingChama', 'approvedAtLendingChama', 'rejectedAt', 'createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!updatedRequest) {
      throw new BadRequestException('Failed to update request');
    }

    this.logger.log(`Terms negotiated for request: ${requestId}`);

    return updatedRequest;
  }

  /**
   * Approve loan request (from either side)
   */
  async approveRequest(dto: ApproveInterChamaRequestDto): Promise<InterChamaLoanRequest> {
    const { requestId, approvedBy, side, finalInterestRate, finalRepaymentPeriodMonths } = dto;

    // Get request
    const requestResult = await this.db.query(
      `SELECT * FROM inter_chama_loan_requests WHERE id = $1`,
      [requestId],
    );

    if (requestResult.rows.length === 0) {
      throw new NotFoundException('Loan request not found');
    }

    const request = mapQueryRow<InterChamaLoanRequest>(requestResult, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
      booleanFields: ['requiresVoteRequesting', 'requiresVoteLending'],
    });

    if (!request) {
      throw new NotFoundException('Loan request not found');
    }

    // Validate approver is admin/treasurer of the correct chama
    const chamaId = side === 'requesting' ? request.requestingChamaId : request.lendingChamaId;
    const approverResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, approvedBy],
    );

    const approverRole = mapQueryRow<{ role: string }>(approverResult)?.role;
    if (!approverRole || !['admin', 'treasurer'].includes(approverRole)) {
      throw new ForbiddenException('Only admin or treasurer can approve requests');
    }

    // Update approval for the appropriate side
    if (side === 'requesting') {
      await this.db.query(
        `UPDATE inter_chama_loan_requests 
         SET approved_by_requesting_chama = $1, approved_at_requesting_chama = NOW(), 
             final_interest_rate = COALESCE($2, final_interest_rate, proposed_interest_rate),
             final_repayment_period_months = COALESCE($3, final_repayment_period_months, proposed_repayment_period_months),
             updated_at = NOW()
         WHERE id = $4`,
        [approvedBy, finalInterestRate, finalRepaymentPeriodMonths, requestId],
      );
    } else {
      await this.db.query(
        `UPDATE inter_chama_loan_requests 
         SET approved_by_lending_chama = $1, approved_at_lending_chama = NOW(), 
             final_interest_rate = COALESCE($2, final_interest_rate, proposed_interest_rate),
             final_repayment_period_months = COALESCE($3, final_repayment_period_months, proposed_repayment_period_months),
             updated_at = NOW()
         WHERE id = $4`,
        [approvedBy, finalInterestRate, finalRepaymentPeriodMonths, requestId],
      );
    }

    // Check if both sides have approved
    const updatedResult = await this.db.query(
      `SELECT * FROM inter_chama_loan_requests WHERE id = $1`,
      [requestId],
    );

    const updatedRequest = mapQueryRow<InterChamaLoanRequest>(updatedResult, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'finalInterestRate', 'finalRepaymentPeriodMonths',
      ],
      booleanFields: ['requiresVoteRequesting', 'requiresVoteLending'],
      dateFields: ['approvedAtRequestingChama', 'approvedAtLendingChama', 'rejectedAt', 'createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!updatedRequest) {
      throw new NotFoundException('Request not found after update');
    }

    // If both sides approved, update status
    if (
      updatedRequest.approvedByRequestingChama &&
      updatedRequest.approvedByLendingChama
    ) {
      await this.db.query(
        `UPDATE inter_chama_loan_requests 
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [InterChamaRequestStatus.APPROVED, requestId],
      );

      updatedRequest.status = InterChamaRequestStatus.APPROVED;

      // Create the loan record
      await this.createLoanFromRequest(updatedRequest);
    } else {
      // Update status based on which side approved
      if (side === 'requesting') {
        await this.db.query(
          `UPDATE inter_chama_loan_requests 
           SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [InterChamaRequestStatus.PENDING_VOTE_LENDING, requestId],
        );
      } else {
        await this.db.query(
          `UPDATE inter_chama_loan_requests 
           SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [InterChamaRequestStatus.PENDING_VOTE_REQUESTING, requestId],
        );
      }
    }

    this.logger.log(`Request approved by ${side} chama: ${requestId}`);

    return updatedRequest;
  }

  /**
   * Reject loan request
   */
  async rejectRequest(dto: RejectInterChamaRequestDto): Promise<InterChamaLoanRequest> {
    const { requestId, rejectedBy, side, reason } = dto;

    // Get request
    const requestResult = await this.db.query(
      `SELECT * FROM inter_chama_loan_requests WHERE id = $1`,
      [requestId],
    );

    if (requestResult.rows.length === 0) {
      throw new NotFoundException('Loan request not found');
    }

    const request = mapQueryRow<InterChamaLoanRequest>(requestResult, {
      numberFields: ['amountRequested'],
    });

    if (!request) {
      throw new NotFoundException('Loan request not found');
    }

    // Validate rejector
    const chamaId = side === 'requesting' ? request.requestingChamaId : request.lendingChamaId;
    const rejectorResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, rejectedBy],
    );

    const rejectorRole = mapQueryRow<{ role: string }>(rejectorResult)?.role;
    if (!rejectorRole || !['admin', 'treasurer'].includes(rejectorRole)) {
      throw new ForbiddenException('Only admin or treasurer can reject requests');
    }

    // Update request
    const result = await this.db.query(
      `UPDATE inter_chama_loan_requests 
       SET status = $1, rejected_by = $2, rejected_at = NOW(), 
           rejection_reason = $3, rejected_by_side = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [InterChamaRequestStatus.REJECTED, rejectedBy, reason, side, requestId],
    );

    const updatedRequest = mapQueryRow<InterChamaLoanRequest>(result, {
      numberFields: ['amountRequested'],
      booleanFields: ['requiresVoteRequesting', 'requiresVoteLending'],
      dateFields: ['approvedAtRequestingChama', 'approvedAtLendingChama', 'rejectedAt', 'createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!updatedRequest) {
      throw new BadRequestException('Failed to reject request');
    }

    this.logger.log(`Request rejected by ${side} chama: ${requestId}. Reason: ${reason}`);

    return updatedRequest;
  }

  // ============================================================================
  // LOAN CREATION & DISBURSEMENT
  // ============================================================================

  /**
   * Create loan from approved request
   */
  private async createLoanFromRequest(
    request: InterChamaLoanRequest,
  ): Promise<InterChamaLoan> {
    const interestRate = request.finalInterestRate || request.proposedInterestRate || 8;
    const repaymentPeriodMonths = request.finalRepaymentPeriodMonths || request.proposedRepaymentPeriodMonths;
    const gracePeriodDays = 14; // Default for inter-chama loans

    // Calculate total amount
    const principal = request.amountRequested;
    const interest = this.calculateSimpleInterest(principal, interestRate, repaymentPeriodMonths);
    const totalAmount = principal + interest;

    // Calculate dates
    const firstPaymentDate = new Date();
    firstPaymentDate.setDate(firstPaymentDate.getDate() + gracePeriodDays + 30);

    const maturityDate = new Date(firstPaymentDate);
    maturityDate.setMonth(maturityDate.getMonth() + repaymentPeriodMonths);

    // Create loan
    const result = await this.db.query(
      `INSERT INTO inter_chama_loans (
        loan_request_id, requesting_chama_id, lending_chama_id,
        principal_amount, interest_rate, total_amount,
        repayment_period_months, repayment_frequency,
        first_payment_date, maturity_date, grace_period_days,
        status, outstanding_balance,
        collateral_type, collateral_description, collateral_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        request.id,
        request.requestingChamaId,
        request.lendingChamaId,
        principal,
        interestRate,
        totalAmount,
        repaymentPeriodMonths,
        'monthly',
        firstPaymentDate,
        maturityDate,
        gracePeriodDays,
        InterChamaLoanStatus.PENDING_DISBURSEMENT,
        totalAmount,
        request.finalCollateral ? 'future_contributions' : null,
        request.finalCollateral || null,
        request.finalCollateralValue || null,
      ],
    );

    const loan = mapQueryRow<InterChamaLoan>(result, {
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

    this.logger.log(`Inter-chama loan created: ${loan.id} for ${principal}`);

    // Generate repayment schedule
    await this.generateRepaymentSchedule(loan);

    return loan;
  }

  /**
   * Disburse inter-chama loan
   */
  async disburseLoan(loanId: string, disbursedBy: string): Promise<InterChamaLoan> {
    const loanResult = await this.db.query(
      `SELECT * FROM inter_chama_loans WHERE id = $1`,
      [loanId],
    );

    if (loanResult.rows.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const loan = mapQueryRow<InterChamaLoan>(loanResult, {
      numberFields: ['principalAmount', 'amountDisbursed', 'outstandingBalance'],
      dateFields: ['disbursedAt', 'createdAt', 'updatedAt'],
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.status !== InterChamaLoanStatus.PENDING_DISBURSEMENT) {
      throw new BadRequestException(`Cannot disburse loan with status: ${loan.status}`);
    }

    // Validate disburser is admin/treasurer of lending chama
    const disburserResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [loan.lendingChamaId, disbursedBy],
    );

    const disburserRole = mapQueryRow<{ role: string }>(disburserResult)?.role;
    if (!disburserRole || !['admin', 'treasurer'].includes(disburserRole)) {
      throw new ForbiddenException('Only admin or treasurer of lending chama can disburse');
    }

    // Check lending chama has sufficient balance
    const lendingChamaBalance = await this.ledgerService.getChamaBalance(loan.lendingChamaId);
    if (lendingChamaBalance < loan.principalAmount) {
      throw new BadRequestException(
        `Insufficient lending chama balance. Required: ${loan.principalAmount}, Available: ${lendingChamaBalance}`,
      );
    }

    // Process disbursement: lending chama -> requesting chama
    const transactionRef = `INTER-CHAMA-LOAN-${loan.id.slice(0, 8)}`;
    
    // Get lending chama name for recipient name
    const lendingChamaResult = await this.db.query(
      `SELECT name FROM chamas WHERE id = $1`,
      [loan.lendingChamaId],
    );
    const lendingChamaName = lendingChamaResult.rows[0]?.name || 'Lending Chama';
    
    try {
      await this.ledgerService.processChamaTransfer({
        sourceChamaId: loan.lendingChamaId,
        destinationType: 'chama',
        destinationChamaId: loan.requestingChamaId,
        amount: loan.principalAmount,
        initiatedBy: disbursedBy,
        reason: `Inter-chama loan disbursement: ${transactionRef}`,
        externalReference: transactionRef,
        recipientName: lendingChamaName,
      });
    } catch (error) {
      this.logger.error(`Failed to disburse inter-chama loan: ${error}`);
      throw new BadRequestException('Failed to disburse loan via ledger');
    }

    // Update loan status
    const result = await this.db.query(
      `UPDATE inter_chama_loans 
       SET status = $1, disbursed_at = NOW(), amount_disbursed = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [InterChamaLoanStatus.ACTIVE, loan.principalAmount, loanId],
    );

    const updatedLoan = mapQueryRow<InterChamaLoan>(result, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'outstandingBalance',
      ],
      dateFields: ['disbursedAt', 'firstPaymentDate', 'maturityDate', 'createdAt', 'updatedAt'],
    });

    if (!updatedLoan) {
      throw new BadRequestException('Failed to update loan status');
    }

    this.logger.log(`Inter-chama loan disbursed: ${loanId} - ${loan.principalAmount} from ${loan.lendingChamaId} to ${loan.requestingChamaId}`);

    return updatedLoan;
  }

  // ============================================================================
  // REPAYMENT
  // ============================================================================

  /**
   * Generate repayment schedule
   */
  private async generateRepaymentSchedule(loan: InterChamaLoan): Promise<void> {
    const { id: loanId, totalAmount, principalAmount, repaymentPeriodMonths, repaymentFrequency, firstPaymentDate } = loan;

    const numberOfPayments = this.calculateNumberOfPayments(repaymentPeriodMonths, repaymentFrequency);
    const installmentAmount = totalAmount / numberOfPayments;
    const principalPerInstallment = principalAmount / numberOfPayments;
    const interestPerInstallment = (totalAmount - principalAmount) / numberOfPayments;

    const dueDate = new Date(firstPaymentDate);

    for (let i = 1; i <= numberOfPayments; i++) {
      await this.db.query(
        `INSERT INTO inter_chama_loan_repayments (
          inter_chama_loan_id, installment_number, due_date, amount_due,
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

      this.advanceDateByFrequency(dueDate, repaymentFrequency);
    }

    this.logger.log(`Generated ${numberOfPayments} repayment installments for inter-chama loan ${loanId}`);
  }

  /**
   * Make repayment on inter-chama loan
   */
  async makeRepayment(
    requestingChamaId: string,
    dto: MakeInterChamaRepaymentDto,
  ): Promise<any> {
    const { loanId, amount, paymentReference, notes } = dto;

    // Get loan
    const loan = await this.getLoanById(loanId);

    // Validate requesting chama matches
    if (loan.requestingChamaId !== requestingChamaId) {
      throw new ForbiddenException('You can only make repayments on loans your chama requested');
    }

    if (loan.status !== InterChamaLoanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot make repayment on loan with status: ${loan.status}`);
    }

    // Get next pending repayment
    const repaymentResult = await this.db.query(
      `SELECT * FROM inter_chama_loan_repayments 
       WHERE inter_chama_loan_id = $1 AND status IN ('pending', 'overdue', 'partial')
       ORDER BY installment_number ASC
       LIMIT 1`,
      [loanId],
    );

    if (repaymentResult.rows.length === 0) {
      throw new BadRequestException('No pending repayments found');
    }

    const repayment = mapQueryRow<any>(repaymentResult, {
      numberFields: ['installmentNumber', 'amountDue', 'principalAmount', 'interestAmount', 'lateFee', 'amountPaid'],
      dateFields: ['dueDate', 'paidAt', 'createdAt', 'updatedAt'],
    });

    if (!repayment) {
      throw new NotFoundException('Repayment not found');
    }

    const amountDue = repayment.amountDue - repayment.amountPaid;

    if (amount > amountDue) {
      throw new BadRequestException(`Payment amount ${amount} exceeds amount due ${amountDue}`);
    }

    // Check requesting chama balance
    const requestingChamaBalance = await this.ledgerService.getChamaBalance(requestingChamaId);
    if (requestingChamaBalance < amount) {
      throw new BadRequestException(
        `Insufficient chama balance. Required: ${amount}, Available: ${requestingChamaBalance}`,
      );
    }

    // Transfer from requesting chama to lending chama
    const transactionRef = paymentReference || `INTER-CHAMA-PAY-${repayment.id.slice(0, 8)}`;
    
    // Get chama names
    const requestingChamaResult = await this.db.query(
      `SELECT name FROM chamas WHERE id = $1`,
      [requestingChamaId],
    );
    const requestingChamaName = requestingChamaResult.rows[0]?.name || 'Requesting Chama';
    
    const lendingChamaResult = await this.db.query(
      `SELECT name FROM chamas WHERE id = $1`,
      [loan.lendingChamaId],
    );
    const lendingChamaName = lendingChamaResult.rows[0]?.name || 'Lending Chama';
    
    try {
      await this.ledgerService.processChamaTransfer({
        sourceChamaId: requestingChamaId,
        destinationType: 'chama',
        destinationChamaId: loan.lendingChamaId,
        amount,
        initiatedBy: requestingChamaId, // Using chama ID as initiator identifier
        reason: `Inter-chama loan repayment installment #${repayment.installmentNumber}: ${transactionRef}`,
        externalReference: transactionRef,
        recipientName: lendingChamaName,
      });
    } catch (error) {
      this.logger.error(`Failed to process repayment: ${error}`);
      throw new BadRequestException('Failed to process repayment via ledger');
    }

    // Update repayment
    const newAmountPaid = repayment.amountPaid + amount;
    const newStatus = newAmountPaid >= repayment.amountDue ? RepaymentStatus.PAID : RepaymentStatus.PARTIAL;

    await this.db.query(
      `UPDATE inter_chama_loan_repayments 
       SET status = $1, amount_paid = $2, paid_at = NOW(), 
           payment_method = $3, payment_reference = $4, notes = $5, updated_at = NOW()
       WHERE id = $6`,
      [newStatus, newAmountPaid, 'chama_wallet', paymentReference, notes, repayment.id],
    );

    // Update loan totals
    await this.db.query(
      `UPDATE inter_chama_loans 
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
      `SELECT outstanding_balance FROM inter_chama_loans WHERE id = $1`,
      [loanId],
    );

    const updatedLoan = mapQueryRow<{ outstandingBalance: number }>(updatedLoanResult, {
      numberFields: ['outstandingBalance'],
    });

    if (updatedLoan && updatedLoan.outstandingBalance <= 0) {
      await this.db.query(
        `UPDATE inter_chama_loans SET status = $1, paid_off_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [InterChamaLoanStatus.PAID_OFF, loanId],
      );

      this.logger.log(`Inter-chama loan fully paid off: ${loanId}`);
    }

    this.logger.log(`Inter-chama loan repayment made: ${amount} for loan ${loanId}`);

    return { success: true, amount, loanId };
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get loan requests for a chama (as requesting or lending)
   */
  async getChamaLoanRequests(
    chamaId: string,
    role?: 'requesting' | 'lending',
    status?: InterChamaRequestStatus,
    limit = 50,
    offset = 0,
  ): Promise<InterChamaLoanRequest[]> {
    let query = `
      SELECT iclr.*, 
        rc.name as requesting_chama_name,
        lc.name as lending_chama_name
      FROM inter_chama_loan_requests iclr
      JOIN chamas rc ON iclr.requesting_chama_id = rc.id
      JOIN chamas lc ON iclr.lending_chama_id = lc.id
      WHERE (iclr.requesting_chama_id = $1 OR iclr.lending_chama_id = $1)
    `;
    const params: any[] = [chamaId];

    if (role === 'requesting') {
      query += ` AND iclr.requesting_chama_id = $1`;
    } else if (role === 'lending') {
      query += ` AND iclr.lending_chama_id = $1`;
    }

    if (status) {
      query += ` AND iclr.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY iclr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<InterChamaLoanRequest>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'finalInterestRate', 'finalRepaymentPeriodMonths', 'collateralValue', 'finalCollateralValue',
        'requestingChamaReputationScore', 'lendingChamaReputationScore',
      ],
      booleanFields: ['requiresVoteRequesting', 'requiresVoteLending'],
      dateFields: [
        'approvedAtRequestingChama', 'approvedAtLendingChama', 'rejectedAt',
        'createdAt', 'updatedAt', 'expiresAt',
      ],
    });
  }

  /**
   * Get loan by ID
   */
  async getLoanById(loanId: string): Promise<InterChamaLoan> {
    const result = await this.db.query(
      `SELECT icl.*, 
        rc.name as requesting_chama_name,
        lc.name as lending_chama_name
       FROM inter_chama_loans icl
       JOIN chamas rc ON icl.requesting_chama_id = rc.id
       JOIN chamas lc ON icl.lending_chama_id = lc.id
       WHERE icl.id = $1`,
      [loanId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Loan not found');
    }

    const loan = mapQueryRow<InterChamaLoan>(result, {
      numberFields: [
        'principalAmount', 'interestRate', 'totalAmount', 'repaymentPeriodMonths',
        'gracePeriodDays', 'amountDisbursed', 'totalPaid', 'outstandingBalance',
      ],
      dateFields: ['disbursedAt', 'firstPaymentDate', 'maturityDate', 'createdAt', 'updatedAt'],
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }

  /**
   * Get inter-chama loans for a chama
   */
  async getChamaInterChamaLoans(
    chamaId: string,
    role?: 'requesting' | 'lending',
    status?: InterChamaLoanStatus,
    limit = 50,
    offset = 0,
  ): Promise<InterChamaLoan[]> {
    let query = `
      SELECT icl.*, 
        rc.name as requesting_chama_name,
        lc.name as lending_chama_name
      FROM inter_chama_loans icl
      JOIN chamas rc ON icl.requesting_chama_id = rc.id
      JOIN chamas lc ON icl.lending_chama_id = lc.id
      WHERE (icl.requesting_chama_id = $1 OR icl.lending_chama_id = $1)
    `;
    const params: any[] = [chamaId];

    if (role === 'requesting') {
      query += ` AND icl.requesting_chama_id = $1`;
    } else if (role === 'lending') {
      query += ` AND icl.lending_chama_id = $1`;
    }

    if (status) {
      query += ` AND icl.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY icl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<InterChamaLoan>(result, {
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
  }

  /**
   * Get inter-chama lending summary for a chama
   */
  async getChamaInterChamaLendingSummary(chamaId: string): Promise<{
    totalLoansReceived: number;
    totalLoansGiven: number;
    activeLoansReceived: number;
    activeLoansGiven: number;
    totalBorrowed: number;
    totalLent: number;
    outstandingBorrowed: number;
    outstandingLent: number;
    defaultedAmount: number;
  }> {
    const result = await this.db.query(
      `SELECT * FROM get_inter_chama_lending_summary($1)`,
      [chamaId],
    );

    const summary = mapQueryRow<{
      totalLoansReceived: number;
      totalLoansGiven: number;
      activeLoansReceived: number;
      activeLoansGiven: number;
      totalBorrowed: number;
      totalLent: number;
      outstandingBorrowed: number;
      outstandingLent: number;
      defaultedAmount: number;
    }>(result, {
      numberFields: [
        'totalLoansReceived', 'totalLoansGiven', 'activeLoansReceived', 'activeLoansGiven',
        'totalBorrowed', 'totalLent', 'outstandingBorrowed', 'outstandingLent', 'defaultedAmount',
      ],
    });

    return {
      totalLoansReceived: summary?.totalLoansReceived || 0,
      totalLoansGiven: summary?.totalLoansGiven || 0,
      activeLoansReceived: summary?.activeLoansReceived || 0,
      activeLoansGiven: summary?.activeLoansGiven || 0,
      totalBorrowed: summary?.totalBorrowed || 0,
      totalLent: summary?.totalLent || 0,
      outstandingBorrowed: summary?.outstandingBorrowed || 0,
      outstandingLent: summary?.outstandingLent || 0,
      defaultedAmount: summary?.defaultedAmount || 0,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private calculateSimpleInterest(principal: number, rate: number, months: number): number {
    return principal * (rate / 100) * (months / 12);
  }

  private calculateNumberOfPayments(months: number, frequency: string): number {
    switch (frequency) {
      case 'daily':
        return months * 30;
      case 'weekly':
        return months * 4;
      case 'biweekly':
        return months * 2;
      case 'monthly':
      default:
        return months;
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
}

