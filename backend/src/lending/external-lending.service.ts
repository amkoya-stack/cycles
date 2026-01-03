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
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum ExternalListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export enum ExternalApplicationStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  PENDING_VOTE = 'pending_vote',
  APPROVED = 'approved',
  TERMS_NEGOTIATED = 'terms_negotiated',
  ESCROW_PENDING = 'escrow_pending',
  ESCROW_RELEASED = 'escrow_released',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

export enum EscrowStatus {
  PENDING = 'pending',
  FUNDED = 'funded',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

export enum RiskSharingStatus {
  PENDING = 'pending',
  AGREED = 'agreed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DEFAULTED = 'defaulted',
  CANCELLED = 'cancelled',
}

export interface CreateListingDto {
  chamaId: string;
  title: string;
  description?: string;
  minAmount: number;
  maxAmount: number;
  interestRateMin: number;
  interestRateMax: number;
  minRepaymentPeriodMonths: number;
  maxRepaymentPeriodMonths: number;
  minBorrowerReputationTier?: string;
  requiresEmploymentVerification?: boolean;
  requiresIncomeProof?: boolean;
  minMonthlyIncome?: number;
  allowsRiskSharing?: boolean;
  maxCoFunders?: number;
}

export interface CreateExternalApplicationDto {
  listingId: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate?: number;
  proposedRepaymentPeriodMonths: number;
  repaymentFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  employmentStatus?: string;
  monthlyIncome?: number;
  employmentDetails?: Record<string, any>;
  incomeProofDocumentId?: string;
}

export interface MarketplaceFilters {
  minAmount?: number;
  maxAmount?: number;
  minInterestRate?: number;
  maxInterestRate?: number;
  minPeriodMonths?: number;
  maxPeriodMonths?: number;
  allowsRiskSharing?: boolean;
  limit?: number;
  offset?: number;
}

export interface ExternalLoanListing {
  id: string;
  chamaId: string;
  createdBy: string;
  title: string;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  interestRateMin: number;
  interestRateMax: number;
  minRepaymentPeriodMonths: number;
  maxRepaymentPeriodMonths: number;
  minBorrowerReputationTier: string | null;
  requiresEmploymentVerification: boolean;
  requiresIncomeProof: boolean;
  minMonthlyIncome: number | null;
  allowsRiskSharing: boolean;
  maxCoFunders: number;
  status: ExternalListingStatus;
  totalApplications: number;
  totalApproved: number;
  totalFunded: number;
  averageInterestRate: number | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface ExternalLoanApplication {
  id: string;
  listingId: string;
  chamaId: string;
  borrowerId: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate: number | null;
  proposedRepaymentPeriodMonths: number;
  repaymentFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  employmentStatus: string | null;
  monthlyIncome: number | null;
  employmentDetails: Record<string, any> | null;
  incomeProofDocumentId: string | null;
  borrowerReputationScore: number | null;
  status: ExternalApplicationStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  finalInterestRate: number | null;
  finalRepaymentPeriodMonths: number | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  requiresVote: boolean;
  voteProposalId: string | null;
  escrowAccountId: string | null;
  escrowAmount: number | null;
  escrowReleasedAt: Date | null;
  isRiskShared: boolean;
  primaryChamaId: string | null;
  coFunderChamas: Record<string, any> | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface EscrowAccount {
  id: string;
  externalLoanApplicationId: string;
  amount: number;
  currency: string;
  fundedByChamas: Record<string, any>;
  status: EscrowStatus;
  releasedAt: Date | null;
  releasedToUserId: string | null;
  releaseTransactionId: string | null;
  refundedAt: Date | null;
  refundTransactionIds: Record<string, any> | null;
  disputeRaisedAt: Date | null;
  disputeRaisedBy: string | null;
  disputeReason: string | null;
  disputeResolvedAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class ExternalLendingService {
  private readonly logger = new Logger(ExternalLendingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledgerService: LedgerService,
  ) {}

  // ============================================================================
  // MARKETPLACE LISTINGS
  // ============================================================================

  /**
   * Create a loan listing (chama offering loans to non-members)
   */
  async createListing(createdBy: string, dto: CreateListingDto): Promise<ExternalLoanListing> {
    const {
      chamaId,
      title,
      description,
      minAmount,
      maxAmount,
      interestRateMin,
      interestRateMax,
      minRepaymentPeriodMonths,
      maxRepaymentPeriodMonths,
      minBorrowerReputationTier,
      requiresEmploymentVerification,
      requiresIncomeProof,
      minMonthlyIncome,
      allowsRiskSharing,
      maxCoFunders,
    } = dto;

    // Validate chama membership and permissions
    const memberResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, createdBy],
    );

    if (memberResult.rows.length === 0) {
      throw new ForbiddenException('You must be an active member of this chama');
    }

    const memberRole = mapQueryRow<{ role: string }>(memberResult)?.role;
    if (!memberRole || !['admin', 'treasurer', 'admin'].includes(memberRole)) {
      throw new ForbiddenException('Only admin, treasurer, or admin can create loan listings');
    }

    // Check if external lending is enabled
    const chamaResult = await this.db.query(
      `SELECT external_lending_enabled FROM chamas WHERE id = $1`,
      [chamaId],
    );

    const chama = mapQueryRow<{ externalLendingEnabled: boolean }>(chamaResult, {
      booleanFields: ['externalLendingEnabled'],
    });

    if (!chama?.externalLendingEnabled) {
      throw new BadRequestException('External lending is not enabled for this chama');
    }

    // Validate amounts
    if (minAmount >= maxAmount) {
      throw new BadRequestException('Minimum amount must be less than maximum amount');
    }

    if (interestRateMin >= interestRateMax) {
      throw new BadRequestException('Minimum interest rate must be less than maximum rate');
    }

    if (minRepaymentPeriodMonths >= maxRepaymentPeriodMonths) {
      throw new BadRequestException('Minimum repayment period must be less than maximum period');
    }

    // Create listing
    const result = await this.db.query(
      `INSERT INTO external_loan_listings (
        chama_id, created_by, title, description,
        min_amount, max_amount, interest_rate_min, interest_rate_max,
        min_repayment_period_months, max_repayment_period_months,
        min_borrower_reputation_tier, requires_employment_verification,
        requires_income_proof, min_monthly_income,
        allows_risk_sharing, max_co_funders, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        chamaId,
        createdBy,
        title,
        description || null,
        minAmount,
        maxAmount,
        interestRateMin,
        interestRateMax,
        minRepaymentPeriodMonths,
        maxRepaymentPeriodMonths,
        minBorrowerReputationTier || null,
        requiresEmploymentVerification || false,
        requiresIncomeProof || false,
        minMonthlyIncome || null,
        allowsRiskSharing || false,
        maxCoFunders || 0,
        ExternalListingStatus.ACTIVE,
      ],
    );

    const listing = mapQueryRow<ExternalLoanListing>(result, {
      numberFields: [
        'minAmount', 'maxAmount', 'interestRateMin', 'interestRateMax',
        'minRepaymentPeriodMonths', 'maxRepaymentPeriodMonths', 'minMonthlyIncome',
        'totalApplications', 'totalApproved', 'totalFunded', 'averageInterestRate',
        'maxCoFunders',
      ],
      booleanFields: [
        'requiresEmploymentVerification', 'requiresIncomeProof', 'allowsRiskSharing',
      ],
      dateFields: ['createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!listing) {
      throw new BadRequestException('Failed to create listing');
    }

    this.logger.log(`Loan listing created: ${listing.id} by chama ${chamaId}`);

    return listing;
  }

  /**
   * Browse marketplace listings with filters
   */
  async browseMarketplace(filters: MarketplaceFilters = {}): Promise<ExternalLoanListing[]> {
    const {
      minAmount,
      maxAmount,
      minInterestRate,
      maxInterestRate,
      minPeriodMonths,
      maxPeriodMonths,
      allowsRiskSharing,
      limit = 50,
      offset = 0,
    } = filters;

    let query = `
      SELECT el.*, c.name as chama_name, c.cover_image as chama_cover_image, 
             COALESCE(c.settings->>'icon', NULL) as chama_icon
      FROM external_loan_listings el
      JOIN chamas c ON el.chama_id = c.id
      WHERE el.status = $1
    `;
    const params: any[] = [ExternalListingStatus.ACTIVE];

    if (minAmount !== undefined) {
      query += ` AND el.max_amount >= $${params.length + 1}`;
      params.push(minAmount);
    }

    if (maxAmount !== undefined) {
      query += ` AND el.min_amount <= $${params.length + 1}`;
      params.push(maxAmount);
    }

    if (minInterestRate !== undefined) {
      query += ` AND el.interest_rate_max >= $${params.length + 1}`;
      params.push(minInterestRate);
    }

    if (maxInterestRate !== undefined) {
      query += ` AND el.interest_rate_min <= $${params.length + 1}`;
      params.push(maxInterestRate);
    }

    if (minPeriodMonths !== undefined) {
      query += ` AND el.max_repayment_period_months >= $${params.length + 1}`;
      params.push(minPeriodMonths);
    }

    if (maxPeriodMonths !== undefined) {
      query += ` AND el.min_repayment_period_months <= $${params.length + 1}`;
      params.push(maxPeriodMonths);
    }

    if (allowsRiskSharing !== undefined) {
      query += ` AND el.allows_risk_sharing = $${params.length + 1}`;
      params.push(allowsRiskSharing);
    }

    query += ` ORDER BY el.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<ExternalLoanListing>(result, {
      numberFields: [
        'minAmount', 'maxAmount', 'interestRateMin', 'interestRateMax',
        'minRepaymentPeriodMonths', 'maxRepaymentPeriodMonths', 'minMonthlyIncome',
        'totalApplications', 'totalApproved', 'totalFunded', 'averageInterestRate',
        'maxCoFunders',
      ],
      booleanFields: [
        'requiresEmploymentVerification', 'requiresIncomeProof', 'allowsRiskSharing',
      ],
      dateFields: ['createdAt', 'updatedAt', 'expiresAt'],
    });
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<{
    verifiedChamas: number;
    activeMembers: number;
    loansDisbursed: number;
    approvalRate: number;
  }> {
    // Verified Chamas: Percentage (100% means all chamas with listings are verified)
    // For now, we'll show 100% if there are any active listings, otherwise 0%
    const verifiedChamasResult = await this.db.query(
      `SELECT COUNT(DISTINCT chama_id) as count
       FROM external_loan_listings
       WHERE status = $1`,
      [ExternalListingStatus.ACTIVE],
    );
    const verifiedChamasCount = parseInt(verifiedChamasResult.rows[0]?.count || '0');
    // Show 100% if there are verified chamas, 0% otherwise
    const verifiedChamas = verifiedChamasCount > 0 ? 100 : 0;

    // Active Members: Total active members across all chamas
    const activeMembersResult = await this.db.query(
      `SELECT COUNT(*) as count
       FROM chama_members
       WHERE status = 'active'`,
    );
    const activeMembers = parseInt(activeMembersResult.rows[0]?.count || '0');

    // Loans Disbursed: Total amount from external loans that have been disbursed
    // This includes both internal and external loans that are active or completed
    const loansDisbursedResult = await this.db.query(
      `SELECT COALESCE(SUM(amount_disbursed), 0) as total
       FROM loans
       WHERE status IN ('active', 'completed')
         AND amount_disbursed IS NOT NULL`,
    );
    const loansDisbursed = parseFloat(loansDisbursedResult.rows[0]?.total || '0');

    // Approval Rate: Percentage of approved external loan applications
    const approvalRateResult = await this.db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'approved')::DECIMAL as approved,
        COUNT(*) FILTER (WHERE status IN ('approved', 'rejected'))::DECIMAL as total
       FROM external_loan_applications
       WHERE status IN ('approved', 'rejected')`,
    );
    const approved = parseFloat(approvalRateResult.rows[0]?.approved || '0');
    const total = parseFloat(approvalRateResult.rows[0]?.total || '0');
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return {
      verifiedChamas,
      activeMembers,
      loansDisbursed,
      approvalRate,
    };
  }

  /**
   * Get listing details
   */
  async getListingDetails(listingId: string): Promise<ExternalLoanListing & { chamaName: string }> {
    const result = await this.db.query(
      `SELECT el.*, c.name as chama_name, c.cover_image as chama_cover_image,
              COALESCE(c.settings->>'icon', NULL) as chama_icon
       FROM external_loan_listings el
       JOIN chamas c ON el.chama_id = c.id
       WHERE el.id = $1`,
      [listingId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Listing not found');
    }

    const listing = mapQueryRow<ExternalLoanListing & { chamaName: string }>(result, {
      numberFields: [
        'minAmount', 'maxAmount', 'interestRateMin', 'interestRateMax',
        'minRepaymentPeriodMonths', 'maxRepaymentPeriodMonths', 'minMonthlyIncome',
        'totalApplications', 'totalApproved', 'totalFunded', 'averageInterestRate',
        'maxCoFunders',
      ],
      booleanFields: [
        'requiresEmploymentVerification', 'requiresIncomeProof', 'allowsRiskSharing',
      ],
      dateFields: ['createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  // ============================================================================
  // EXTERNAL LOAN APPLICATIONS
  // ============================================================================

  /**
   * Apply for an external loan (non-member applying to chama)
   */
  async createExternalApplication(
    borrowerId: string,
    dto: CreateExternalApplicationDto,
  ): Promise<ExternalLoanApplication> {
    const {
      listingId,
      amountRequested,
      purpose,
      proposedInterestRate,
      proposedRepaymentPeriodMonths,
      repaymentFrequency,
      employmentStatus,
      monthlyIncome,
      employmentDetails,
      incomeProofDocumentId,
    } = dto;

    // Get listing
    const listing = await this.getListingDetails(listingId);

    // Validate amount is within listing range
    if (amountRequested < listing.minAmount || amountRequested > listing.maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${listing.minAmount} and ${listing.maxAmount}`,
      );
    }

    // Validate interest rate
    const interestRate = proposedInterestRate || listing.interestRateMin;
    if (interestRate < listing.interestRateMin || interestRate > listing.interestRateMax) {
      throw new BadRequestException(
        `Interest rate must be between ${listing.interestRateMin}% and ${listing.interestRateMax}%`,
      );
    }

    // Validate repayment period
    if (
      proposedRepaymentPeriodMonths < listing.minRepaymentPeriodMonths ||
      proposedRepaymentPeriodMonths > listing.maxRepaymentPeriodMonths
    ) {
      throw new BadRequestException(
        `Repayment period must be between ${listing.minRepaymentPeriodMonths} and ${listing.maxRepaymentPeriodMonths} months`,
      );
    }

    // Check if borrower is already a member (should use internal lending)
    const memberCheck = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [listing.chamaId, borrowerId],
    );

    if (memberCheck.rows.length > 0) {
      throw new BadRequestException(
        'You are already a member of this chama. Please use internal lending instead.',
      );
    }

    // Check for existing pending application
    const existingResult = await this.db.query(
      `SELECT id FROM external_loan_applications 
       WHERE listing_id = $1 AND borrower_id = $2 
       AND status IN ('submitted', 'under_review', 'pending_vote', 'approved', 'escrow_pending')`,
      [listingId, borrowerId],
    );

    if (existingResult.rows.length > 0) {
      throw new BadRequestException('You already have a pending application for this listing');
    }

    // Validate employment/income requirements
    if (listing.requiresEmploymentVerification && !employmentStatus) {
      throw new BadRequestException('Employment status is required for this listing');
    }

    if (listing.requiresIncomeProof && !incomeProofDocumentId) {
      throw new BadRequestException('Income proof document is required for this listing');
    }

    if (listing.minMonthlyIncome && (!monthlyIncome || monthlyIncome < listing.minMonthlyIncome)) {
      throw new BadRequestException(
        `Minimum monthly income of ${listing.minMonthlyIncome} is required`,
      );
    }

    // Get borrower reputation (if they've borrowed before)
    const reputationResult = await this.db.query(
      `SELECT AVG(total_score)::INTEGER as avg_score
       FROM reputation_scores
       WHERE user_id = $1`,
      [borrowerId],
    );

    const borrowerReputationScore = reputationResult.rows[0]?.avg_score || null;

    // Create application
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const result = await this.db.query(
      `INSERT INTO external_loan_applications (
        listing_id, chama_id, borrower_id,
        amount_requested, purpose, proposed_interest_rate, proposed_repayment_period_months,
        repayment_frequency, employment_status, monthly_income, employment_details, income_proof_document_id,
        borrower_reputation_score, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        listingId,
        listing.chamaId,
        borrowerId,
        amountRequested,
        purpose,
        interestRate,
        proposedRepaymentPeriodMonths,
        repaymentFrequency || 'monthly',
        employmentStatus || null,
        monthlyIncome || null,
        employmentDetails ? JSON.stringify(employmentDetails) : null,
        incomeProofDocumentId || null,
        borrowerReputationScore,
        ExternalApplicationStatus.SUBMITTED,
        expiresAt,
      ],
    );

    const application = mapQueryRow<ExternalLoanApplication>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'monthlyIncome', 'borrowerReputationScore', 'escrowAmount',
        'finalInterestRate', 'finalRepaymentPeriodMonths',
      ],
      booleanFields: ['requiresVote', 'isRiskShared'],
      dateFields: [
        'approvedAt', 'rejectedAt', 'escrowReleasedAt', 'createdAt', 'updatedAt', 'expiresAt',
      ],
    });

    if (!application) {
      throw new BadRequestException('Failed to create application');
    }

    // Update listing statistics
    await this.db.query(
      `UPDATE external_loan_listings 
       SET total_applications = total_applications + 1, updated_at = NOW()
       WHERE id = $1`,
      [listingId],
    );

    this.logger.log(`External loan application created: ${application.id} for ${amountRequested}`);

    return application;
  }

  /**
   * Get external applications for a chama
   */
  async getChamaExternalApplications(
    chamaId: string,
    status?: ExternalApplicationStatus,
    limit = 50,
    offset = 0,
  ): Promise<ExternalLoanApplication[]> {
    let query = `
      SELECT ela.*, u.full_name as borrower_name, u.email as borrower_email
      FROM external_loan_applications ela
      JOIN users u ON ela.borrower_id = u.id
      WHERE ela.chama_id = $1
    `;
    const params: any[] = [chamaId];

    if (status) {
      query += ` AND ela.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY ela.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    const applications = mapQueryResult<ExternalLoanApplication>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'monthlyIncome', 'borrowerReputationScore', 'escrowAmount',
        'finalInterestRate', 'finalRepaymentPeriodMonths',
      ],
      booleanFields: ['requiresVote', 'isRiskShared'],
      dateFields: [
        'approvedAt', 'rejectedAt', 'escrowReleasedAt', 'createdAt', 'updatedAt', 'expiresAt',
      ],
    });

    // Ensure repaymentFrequency has a default value
    return applications.map(app => ({
      ...app,
      repaymentFrequency: app.repaymentFrequency || 'monthly',
    }));
  }

  /**
   * Get user's external loan applications
   */
  async getUserExternalApplications(borrowerId: string): Promise<ExternalLoanApplication[]> {
    const result = await this.db.query(
      `SELECT ela.*, el.title as listing_title, c.name as chama_name
       FROM external_loan_applications ela
       JOIN external_loan_listings el ON ela.listing_id = el.id
       JOIN chamas c ON ela.chama_id = c.id
       WHERE ela.borrower_id = $1
       ORDER BY ela.created_at DESC`,
      [borrowerId],
    );

    return mapQueryResult<ExternalLoanApplication>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'monthlyIncome', 'borrowerReputationScore', 'escrowAmount',
        'finalInterestRate', 'finalRepaymentPeriodMonths',
      ],
      booleanFields: ['requiresVote', 'isRiskShared'],
      dateFields: [
        'approvedAt', 'rejectedAt', 'escrowReleasedAt', 'createdAt', 'updatedAt', 'expiresAt',
      ],
    });
  }

  // ============================================================================
  // ESCROW MANAGEMENT
  // ============================================================================

  /**
   * Create escrow account for approved application
   */
  async createEscrowAccount(applicationId: string, createdBy?: string): Promise<EscrowAccount> {
    // Get application
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Application not found');
    }

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested', 'escrowAmount'],
      booleanFields: ['isRiskShared'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== ExternalApplicationStatus.APPROVED &&
        application.status !== ExternalApplicationStatus.TERMS_NEGOTIATED) {
      throw new BadRequestException(`Cannot create escrow for application with status: ${application.status}`);
    }

    // Validate creator is admin/treasurer/admin of lending chama
    if (createdBy) {
      const creatorResult = await this.db.query(
        `SELECT role FROM chama_members 
         WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
        [application.chamaId, createdBy],
      );

      const creatorRole = mapQueryRow<{ role: string }>(creatorResult)?.role;
      if (!creatorRole || !['admin', 'treasurer'].includes(creatorRole)) {
        throw new ForbiddenException('Only admin or treasurer can create escrow accounts');
      }
    }

    // Check if escrow already exists
    if (application.escrowAccountId) {
      const existingEscrow = await this.getEscrowAccount(application.escrowAccountId);
      return existingEscrow;
    }

    // Create escrow account in ledger
    const escrowAmount = application.escrowAmount || application.amountRequested;
    const fundedByChamas = application.isRiskShared && application.coFunderChamas
      ? application.coFunderChamas
      : [{ chamaId: application.chamaId, amount: escrowAmount, fundedAt: new Date().toISOString() }];

    const escrowName = `Escrow for Loan Application ${applicationId.substring(0, 8)}`;
    const ledgerEscrowAccount = await this.ledgerService.createEscrowAccount(
      applicationId,
      escrowName,
      { externalLoanApplicationId: applicationId },
    );

    // Create escrow record in database
    const result = await this.db.query(
      `INSERT INTO escrow_accounts (
        id, external_loan_application_id, amount, funded_by_chamas, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        ledgerEscrowAccount.id, // Use ledger account ID as escrow ID
        applicationId,
        escrowAmount,
        JSON.stringify(fundedByChamas),
        EscrowStatus.PENDING,
      ],
    );

    const escrow = mapQueryRow<EscrowAccount>(result, {
      numberFields: ['amount'],
      dateFields: ['releasedAt', 'refundedAt', 'disputeRaisedAt', 'disputeResolvedAt', 'createdAt', 'updatedAt'],
    });

    if (!escrow) {
      throw new BadRequestException('Failed to create escrow account');
    }

    // Update application with escrow account ID
    await this.db.query(
      `UPDATE external_loan_applications 
       SET escrow_account_id = $1, escrow_amount = $2, status = $3, updated_at = NOW()
       WHERE id = $4`,
      [escrow.id, escrowAmount, ExternalApplicationStatus.ESCROW_PENDING, applicationId],
    );

    this.logger.log(`Escrow account created: ${escrow.id} for application ${applicationId}`);

    return escrow;
  }

  /**
   * Fund escrow account (transfer funds from chama wallet(s) to escrow)
   */
  async fundEscrowAccount(escrowId: string, fundedBy: string): Promise<EscrowAccount> {
    const escrow = await this.getEscrowAccount(escrowId);

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new BadRequestException(`Escrow is not in pending status: ${escrow.status}`);
    }

    // Get application to determine which chamas need to fund
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [escrow.externalLoanApplicationId],
    );

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested'],
      booleanFields: ['isRiskShared'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Get funding chamas
    const fundedByChamas = escrow.fundedByChamas as any[];
    
    // Validate funder is admin/treasurer/admin of at least one funding chama
    let hasPermission = false;
    for (const chamaFunding of fundedByChamas) {
      const funderResult = await this.db.query(
        `SELECT role FROM chama_members 
         WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
        [chamaFunding.chamaId, fundedBy],
      );

      const funderRole = mapQueryRow<{ role: string }>(funderResult)?.role;
      if (funderRole && ['admin', 'treasurer'].includes(funderRole)) {
        hasPermission = true;
        break;
      }
    }

    if (!hasPermission) {
      throw new ForbiddenException('Only admin or treasurer of a funding chama can fund escrow');
    }
    
    // Fund from each chama
    const fundingTransactions: string[] = [];
    for (const chamaFunding of fundedByChamas) {
      // Check chama balance
      const chamaBalance = await this.ledgerService.getChamaBalance(chamaFunding.chamaId);
      if (chamaBalance < chamaFunding.amount) {
        throw new BadRequestException(
          `Insufficient balance for chama ${chamaFunding.chamaId}. Required: ${chamaFunding.amount}, Available: ${chamaBalance}`,
        );
      }

      // Transfer funds to escrow via ledger
      const fundingResult = await this.ledgerService.fundEscrow(
        escrowId,
        chamaFunding.chamaId,
        chamaFunding.amount,
        `Escrow funding for external loan application ${escrow.externalLoanApplicationId}`,
        `ESCROW-FUND-${escrowId}-${chamaFunding.chamaId}`,
      );

      fundingTransactions.push(fundingResult.transactionId);
      
      // Update funding record with transaction ID
      chamaFunding.transactionId = fundingResult.transactionId;
      chamaFunding.fundedAt = new Date().toISOString();
    }

    // Update escrow status to funded
    const result = await this.db.query(
      `UPDATE escrow_accounts 
       SET status = $1, funded_by_chamas = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [EscrowStatus.FUNDED, JSON.stringify(fundedByChamas), escrowId],
    );

    const updatedEscrow = mapQueryRow<EscrowAccount>(result, {
      numberFields: ['amount'],
      dateFields: ['releasedAt', 'refundedAt', 'disputeRaisedAt', 'disputeResolvedAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedEscrow) {
      throw new BadRequestException('Failed to update escrow');
    }

    this.logger.log(`Escrow account funded: ${escrowId} with ${fundedByChamas.length} chama(s)`);

    return updatedEscrow;
  }

  /**
   * Release escrow funds to borrower
   */
  async releaseEscrow(escrowId: string, releasedBy: string): Promise<EscrowAccount> {
    const escrow = await this.getEscrowAccount(escrowId);

    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new BadRequestException(`Escrow must be funded before release: ${escrow.status}`);
    }

    // Get application
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [escrow.externalLoanApplicationId],
    );

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Validate releaser is admin/treasurer/admin of primary chama
    const fundedByChamas = escrow.fundedByChamas as any[];
    const primaryChama = fundedByChamas[0];
    
    const releaserResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [primaryChama.chamaId, releasedBy],
    );

    const releaserRole = mapQueryRow<{ role: string }>(releaserResult)?.role;
    if (!releaserRole || !['admin', 'treasurer'].includes(releaserRole)) {
      throw new ForbiddenException('Only admin or treasurer can release escrow');
    }

    // Release escrow via ledger
    const releaseResult = await this.ledgerService.releaseEscrow(
      escrowId,
      application.borrowerId,
      escrow.amount,
      `External loan disbursement via escrow: ${escrowId}`,
      `ESCROW-REL-${escrowId}`,
    );

    // Update escrow
    const result = await this.db.query(
      `UPDATE escrow_accounts 
       SET status = $1, released_at = NOW(), released_to_user_id = $2, 
           release_transaction_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [EscrowStatus.RELEASED, application.borrowerId, releaseResult.transactionId, escrowId],
    );

    const updatedEscrow = mapQueryRow<EscrowAccount>(result, {
      numberFields: ['amount'],
      dateFields: ['releasedAt', 'refundedAt', 'disputeRaisedAt', 'disputeResolvedAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedEscrow) {
      throw new BadRequestException('Failed to update escrow');
    }

    // Update application status
    await this.db.query(
      `UPDATE external_loan_applications 
       SET status = $1, escrow_released_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [ExternalApplicationStatus.ESCROW_RELEASED, escrow.externalLoanApplicationId],
    );

    this.logger.log(`Escrow released: ${escrowId} to borrower ${application.borrowerId}`);

    return updatedEscrow;
  }

  /**
   * Get escrow account details
   */
  async getEscrowAccount(escrowId: string): Promise<EscrowAccount> {
    const result = await this.db.query(
      `SELECT * FROM escrow_accounts WHERE id = $1`,
      [escrowId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Escrow account not found');
    }

    const escrow = mapQueryRow<EscrowAccount>(result, {
      numberFields: ['amount'],
      dateFields: ['releasedAt', 'refundedAt', 'disputeRaisedAt', 'disputeResolvedAt', 'createdAt', 'updatedAt'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow account not found');
    }

    return escrow;
  }

  // ============================================================================
  // APPROVAL/REJECTION (similar to internal lending)
  // ============================================================================

  /**
   * Approve external loan application
   */
  async approveExternalApplication(
    applicationId: string,
    approvedBy: string,
    finalInterestRate?: number,
    finalRepaymentPeriodMonths?: number,
    repaymentFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly',
  ): Promise<ExternalLoanApplication> {
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Application not found');
    }

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Validate approver
    const approverResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [application.chamaId, approvedBy],
    );

    const approverRole = mapQueryRow<{ role: string }>(approverResult)?.role;
    if (!approverRole || !['admin', 'treasurer'].includes(approverRole)) {
      throw new ForbiddenException('Only admin or treasurer can approve applications');
    }

    // Update application
    const result = await this.db.query(
      `UPDATE external_loan_applications 
       SET status = $1, approved_by = $2, approved_at = NOW(),
           final_interest_rate = $3, final_repayment_period_months = $4,
           repayment_frequency = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        ExternalApplicationStatus.APPROVED,
        approvedBy,
        finalInterestRate || application.proposedInterestRate,
        finalRepaymentPeriodMonths || application.proposedRepaymentPeriodMonths,
        repaymentFrequency || application.repaymentFrequency || 'monthly',
        applicationId,
      ],
    );

    const updatedApplication = mapQueryRow<ExternalLoanApplication>(result, {
      numberFields: [
        'amountRequested', 'proposedInterestRate', 'proposedRepaymentPeriodMonths',
        'finalInterestRate', 'finalRepaymentPeriodMonths',
      ],
      booleanFields: ['requiresVote', 'isRiskShared'],
      dateFields: ['approvedAt', 'rejectedAt', 'createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!updatedApplication) {
      throw new BadRequestException('Failed to approve application');
    }

    // Update listing statistics
    await this.db.query(
      `UPDATE external_loan_listings 
       SET total_approved = total_approved + 1, updated_at = NOW()
       WHERE id = $1`,
      [application.listingId],
    );

    this.logger.log(`External loan application approved: ${applicationId}`);

    return updatedApplication;
  }

  /**
   * Reject external loan application
   */
  async rejectExternalApplication(
    applicationId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<ExternalLoanApplication> {
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Application not found');
    }

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Validate rejector
    const rejectorResult = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [application.chamaId, rejectedBy],
    );

    const rejectorRole = mapQueryRow<{ role: string }>(rejectorResult)?.role;
    if (!rejectorRole || !['admin', 'treasurer'].includes(rejectorRole)) {
      throw new ForbiddenException('Only admin or treasurer can reject applications');
    }

    // Update application
    const result = await this.db.query(
      `UPDATE external_loan_applications 
       SET status = $1, rejected_by = $2, rejected_at = NOW(), rejection_reason = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [ExternalApplicationStatus.REJECTED, rejectedBy, reason, applicationId],
    );

    const updatedApplication = mapQueryRow<ExternalLoanApplication>(result, {
      numberFields: ['amountRequested'],
      booleanFields: ['requiresVote', 'isRiskShared'],
      dateFields: ['approvedAt', 'rejectedAt', 'createdAt', 'updatedAt', 'expiresAt'],
    });

    if (!updatedApplication) {
      throw new BadRequestException('Failed to reject application');
    }

    this.logger.log(`External loan application rejected: ${applicationId}. Reason: ${reason}`);

    return updatedApplication;
  }

  // ============================================================================
  // RISK SHARING COORDINATION
  // ============================================================================

  /**
   * Create or update risk sharing agreement for an application
   */
  async createRiskSharingAgreement(
    applicationId: string,
    primaryChamaId: string,
    primaryChamaAmount: number,
    coFunders: Array<{ chamaId: string; amount: number }>,
  ): Promise<any> {
    // Get application
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [applicationId],
    );

    if (appResult.rows.length === 0) {
      throw new NotFoundException('Application not found');
    }

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Validate total equals loan amount
    const totalAmount = primaryChamaAmount + coFunders.reduce((sum, cf) => sum + cf.amount, 0);
    if (Math.abs(totalAmount - application.amountRequested) > 0.01) {
      throw new BadRequestException(
        `Total funding (${totalAmount}) must equal loan amount (${application.amountRequested})`,
      );
    }

    // Calculate percentages
    const primaryPercentage = (primaryChamaAmount / application.amountRequested) * 100;
    const coFundersWithPercentage = coFunders.map((cf) => ({
      ...cf,
      percentage: (cf.amount / application.amountRequested) * 100,
      agreedAt: new Date().toISOString(),
    }));

    // Check if agreement already exists
    const existingResult = await this.db.query(
      `SELECT id FROM risk_sharing_agreements WHERE external_loan_application_id = $1`,
      [applicationId],
    );

    if (existingResult.rows.length > 0) {
      // Update existing agreement
      const result = await this.db.query(
        `UPDATE risk_sharing_agreements 
         SET total_loan_amount = $1, primary_chama_id = $2, primary_chama_amount = $3,
             primary_chama_percentage = $4, co_funders = $5, status = $6, updated_at = NOW()
         WHERE external_loan_application_id = $7
         RETURNING *`,
        [
          application.amountRequested,
          primaryChamaId,
          primaryChamaAmount,
          primaryPercentage,
          JSON.stringify(coFundersWithPercentage),
          RiskSharingStatus.PENDING,
          applicationId,
        ],
      );

      return mapQueryRow<any>(result, {
        numberFields: [
          'totalLoanAmount', 'primaryChamaAmount', 'primaryChamaPercentage',
        ],
        booleanFields: ['requiresVote', 'primaryChamaVoted', 'allCoFundersVoted'],
        dateFields: ['createdAt', 'updatedAt'],
      });
    } else {
      // Create new agreement
      const result = await this.db.query(
        `INSERT INTO risk_sharing_agreements (
          external_loan_application_id, total_loan_amount,
          primary_chama_id, primary_chama_amount, primary_chama_percentage,
          co_funders, profit_sharing_method, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          applicationId,
          application.amountRequested,
          primaryChamaId,
          primaryChamaAmount,
          primaryPercentage,
          JSON.stringify(coFundersWithPercentage),
          'proportional',
          RiskSharingStatus.PENDING,
        ],
      );

      const agreement = mapQueryRow<any>(result, {
        numberFields: [
          'totalLoanAmount', 'primaryChamaAmount', 'primaryChamaPercentage',
        ],
        booleanFields: ['requiresVote', 'primaryChamaVoted', 'allCoFundersVoted'],
        dateFields: ['createdAt', 'updatedAt'],
      });

      // Update application
      await this.db.query(
        `UPDATE external_loan_applications 
         SET is_risk_shared = $1, primary_chama_id = $2, co_funder_chamas = $3, updated_at = NOW()
         WHERE id = $4`,
        [true, primaryChamaId, JSON.stringify(coFundersWithPercentage), applicationId],
      );

      this.logger.log(
        `Risk sharing agreement created: ${agreement?.id} for application ${applicationId}`,
      );

      return agreement;
    }
  }

  /**
   * Get risk sharing agreement for an application
   */
  async getRiskSharingAgreement(applicationId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT rsa.*, c.name as primary_chama_name
       FROM risk_sharing_agreements rsa
       JOIN chamas c ON rsa.primary_chama_id = c.id
       WHERE rsa.external_loan_application_id = $1`,
      [applicationId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapQueryRow<any>(result, {
      numberFields: [
        'totalLoanAmount', 'primaryChamaAmount', 'primaryChamaPercentage',
      ],
      booleanFields: ['requiresVote', 'primaryChamaVoted', 'allCoFundersVoted'],
      dateFields: ['createdAt', 'updatedAt'],
    });
  }

  /**
   * Update escrow funding to include all co-funders
   */
  async updateEscrowForRiskSharing(escrowId: string): Promise<EscrowAccount> {
    const escrow = await this.getEscrowAccount(escrowId);

    // Get application
    const appResult = await this.db.query(
      `SELECT * FROM external_loan_applications WHERE id = $1`,
      [escrow.externalLoanApplicationId],
    );

    const application = mapQueryRow<ExternalLoanApplication>(appResult, {
      numberFields: ['amountRequested'],
      booleanFields: ['isRiskShared'],
    });

    if (!application || !application.isRiskShared) {
      return escrow; // Not risk shared, return as is
    }

    // Get risk sharing agreement
    const agreement = await this.getRiskSharingAgreement(escrow.externalLoanApplicationId);
    if (!agreement) {
      return escrow; // No agreement found
    }

    // Build funded_by_chamas array from agreement
    const fundedByChamas = [
      {
        chamaId: agreement.primaryChamaId,
        amount: agreement.primaryChamaAmount,
        percentage: agreement.primaryChamaPercentage,
      },
      ...(agreement.coFunders || []),
    ].map((cf) => ({
      chamaId: cf.chamaId,
      amount: cf.amount,
      percentage: cf.percentage,
      fundedAt: new Date().toISOString(),
    }));

    // Update escrow with all chamas
    const result = await this.db.query(
      `UPDATE escrow_accounts 
       SET funded_by_chamas = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(fundedByChamas), escrowId],
    );

    return mapQueryRow<EscrowAccount>(result, {
      numberFields: ['amount'],
      dateFields: ['releasedAt', 'refundedAt', 'disputeRaisedAt', 'disputeResolvedAt', 'createdAt', 'updatedAt'],
    })!;
  }
}

