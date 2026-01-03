/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';
import { v4 as uuidv4 } from 'uuid';
import { DisputeNotificationService } from './dispute-notification.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum DisputeType {
  PAYMENT_DISPUTE = 'payment_dispute',
  PAYOUT_DISPUTE = 'payout_dispute',
  MEMBERSHIP_DISPUTE = 'membership_dispute',
  LOAN_DEFAULT = 'loan_default',
  RULE_VIOLATION = 'rule_violation',
}

export enum DisputeStatus {
  FILED = 'filed',
  UNDER_REVIEW = 'under_review',
  DISCUSSION = 'discussion',
  VOTING = 'voting',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
  DISMISSED = 'dismissed',
}

export enum ResolutionType {
  MEDIATION = 'mediation',
  REFUND = 'refund',
  REPAYMENT_PLAN = 'repayment_plan',
  MEMBER_SUSPENSION = 'member_suspension',
  MEMBER_EXPULSION = 'member_expulsion',
  CHAMA_DISSOLUTION = 'chama_dissolution',
  NO_ACTION = 'no_action',
  OTHER = 'other',
}

export interface CreateDisputeDto {
  chamaId: string;
  filedAgainstUserId?: string;
  disputeType: DisputeType;
  title: string;
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  amountDisputed?: number;
  relatedTransactionId?: string;
  relatedLoanId?: string;
  relatedContributionId?: string;
  relatedPayoutId?: string;
  metadata?: Record<string, any>;
}

export interface AddEvidenceDto {
  evidenceType: 'document' | 'screenshot' | 'chat_log' | 'transaction_record' | 'other';
  title: string;
  description?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  externalReference?: string;
  metadata?: Record<string, any>;
}

export interface AddCommentDto {
  content: string;
  parentCommentId?: string;
  isInternal?: boolean;
}

export interface CastVoteDto {
  voteType: 'for' | 'against' | 'abstain';
  comment?: string;
}

export interface ResolveDisputeDto {
  resolutionType: ResolutionType;
  resolutionDetails: Record<string, any>;
  implementationNotes?: string;
}

export interface EscalateDisputeDto {
  escalationReason: string;
  metadata?: Record<string, any>;
}

export interface Dispute {
  id: string;
  chamaId: string;
  filedByUserId: string;
  filedAgainstUserId?: string;
  disputeType: DisputeType;
  title: string;
  description: string;
  status: DisputeStatus;
  resolutionType?: ResolutionType;
  resolutionDetails?: Record<string, any>;
  priority: string;
  amountDisputed?: number;
  relatedTransactionId?: string;
  relatedLoanId?: string;
  relatedContributionId?: string;
  relatedPayoutId?: string;
  evidenceCount: number;
  commentCount: number;
  voteCount: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  requiredVotes?: number;
  votingDeadline?: Date;
  discussionDeadline?: Date;
  resolvedAt?: Date;
  resolvedByUserId?: string;
  escalatedAt?: Date;
  escalatedToPlatform: boolean;
  platformResolution?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly db: DatabaseService,
    @Optional()
    @Inject(forwardRef(() => DisputeNotificationService))
    private readonly notificationService?: DisputeNotificationService,
  ) {}

  // ============================================================================
  // DISPUTE CREATION
  // ============================================================================

  /**
   * File a new dispute
   */
  async fileDispute(userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    // Verify user is a member of the chama
    const membership = await this.db.query(
      `SELECT id, role, status FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [dto.chamaId, userId],
    );

    if (membership.rows.length === 0) {
      throw new ForbiddenException('You must be an active member to file a dispute');
    }

    // Validate dispute type specific requirements
    if (dto.disputeType === DisputeType.PAYMENT_DISPUTE && !dto.relatedTransactionId) {
      throw new BadRequestException('Payment disputes require a related transaction');
    }

    if (dto.disputeType === DisputeType.PAYOUT_DISPUTE && !dto.relatedPayoutId) {
      throw new BadRequestException('Payout disputes require a related payout');
    }

    if (dto.disputeType === DisputeType.LOAN_DEFAULT && !dto.relatedLoanId) {
      throw new BadRequestException('Loan default disputes require a related loan');
    }

    // Create dispute
    const result = await this.db.query(
      `INSERT INTO disputes (
        chama_id, filed_by_user_id, filed_against_user_id, dispute_type,
        title, description, status, priority, amount_disputed,
        related_transaction_id, related_loan_id, related_contribution_id,
        related_payout_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        dto.chamaId,
        userId,
        dto.filedAgainstUserId || null,
        dto.disputeType,
        dto.title,
        dto.description,
        DisputeStatus.FILED,
        dto.priority || 'normal',
        dto.amountDisputed || null,
        dto.relatedTransactionId || null,
        dto.relatedLoanId || null,
        dto.relatedContributionId || null,
        dto.relatedPayoutId || null,
        JSON.stringify(dto.metadata || {}),
      ],
    );

    const dispute = mapQueryRow<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });

    if (!dispute) {
      throw new BadRequestException('Failed to create dispute');
    }

    this.logger.log(`Dispute filed: ${dispute.id} by user ${userId} in chama ${dto.chamaId}`);

    // Notify chama members about new dispute
    if (this.notificationService) {
      this.notificationService.notifyDisputeFiled(dispute).catch((err: any) => {
        this.logger.error(`Failed to send dispute notification: ${err.message}`);
      });
    }

    return dispute;
  }

  // ============================================================================
  // EVIDENCE MANAGEMENT
  // ============================================================================

  /**
   * Add evidence to a dispute
   */
  async addEvidence(
    userId: string,
    disputeId: string,
    dto: AddEvidenceDto,
  ): Promise<any> {
    // Verify dispute exists and user has access
    await this.verifyDisputeAccess(userId, disputeId);

    const result = await this.db.query(
      `INSERT INTO dispute_evidence (
        dispute_id, submitted_by_user_id, evidence_type, title, description,
        file_url, file_type, file_size, external_reference, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        disputeId,
        userId,
        dto.evidenceType,
        dto.title,
        dto.description || null,
        dto.fileUrl || null,
        dto.fileType || null,
        dto.fileSize || null,
        dto.externalReference || null,
        JSON.stringify(dto.metadata || {}),
      ],
    );

    const evidence = mapQueryRow<any>(result, {
      numberFields: ['fileSize'],
      dateFields: ['createdAt'],
    });

    // Notify about new evidence
    if (this.notificationService && evidence) {
      const dispute = await this.getDispute(disputeId, userId);
      const user = await this.db.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      this.notificationService.notifyEvidenceAdded(dispute, evidence, user.rows[0]?.full_name || 'Unknown').catch((err: any) => {
        this.logger.error(`Failed to send evidence notification: ${err.message}`);
      });
    }

    return evidence;
  }

  /**
   * Get all evidence for a dispute
   */
  async getDisputeEvidence(disputeId: string, userId: string): Promise<any[]> {
    await this.verifyDisputeAccess(userId, disputeId);

    const result = await this.db.query(
      `SELECT de.*, u.full_name as submitted_by_name
       FROM dispute_evidence de
       JOIN users u ON de.submitted_by_user_id = u.id
       WHERE de.dispute_id = $1
       ORDER BY de.created_at ASC`,
      [disputeId],
    );

    return mapQueryResult<any>(result, {
      numberFields: ['fileSize'],
      dateFields: ['createdAt'],
    });
  }

  // ============================================================================
  // DISCUSSION & COMMENTS
  // ============================================================================

  /**
   * Add a comment to dispute discussion
   */
  async addComment(
    userId: string,
    disputeId: string,
    dto: AddCommentDto,
  ): Promise<any> {
    // Verify access
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    // Check if dispute is in discussion phase
    const dispute = await this.getDispute(disputeId, userId);
    if (dispute.status !== DisputeStatus.DISCUSSION && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot add comments when dispute is in ${dispute.status} status`);
    }

    // Only admins can add internal comments
    if (dto.isInternal && membership.role !== 'admin') {
      throw new ForbiddenException('Only admins can add internal comments');
    }

    const result = await this.db.query(
      `INSERT INTO dispute_comments (
        dispute_id, user_id, parent_comment_id, content, is_internal
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        disputeId,
        userId,
        dto.parentCommentId || null,
        dto.content,
        dto.isInternal || false,
      ],
    );

    const comment = mapQueryRow<any>(result, {
      booleanFields: ['isInternal'],
      dateFields: ['createdAt', 'updatedAt'],
    });

    // Notify about new comment (if not internal)
    if (this.notificationService && comment && !dto.isInternal) {
      const dispute = await this.getDispute(disputeId, userId);
      this.notificationService.notifyCommentAdded(dispute, comment).catch((err: any) => {
        this.logger.error(`Failed to send comment notification: ${err.message}`);
      });
    }

    return comment;
  }

  /**
   * Get all comments for a dispute
   */
  async getDisputeComments(disputeId: string, userId: string): Promise<any[]> {
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    // Non-admins can't see internal comments
    const query = membership.role === 'admin'
      ? `SELECT dc.*, u.full_name as user_name, u.profile_photo_url
         FROM dispute_comments dc
         JOIN users u ON dc.user_id = u.id
         WHERE dc.dispute_id = $1
         ORDER BY dc.created_at ASC`
      : `SELECT dc.*, u.full_name as user_name, u.profile_photo_url
         FROM dispute_comments dc
         JOIN users u ON dc.user_id = u.id
         WHERE dc.dispute_id = $1 AND dc.is_internal = FALSE
         ORDER BY dc.created_at ASC`;

    const result = await this.db.query(query, [disputeId]);

    return mapQueryResult<any>(result, {
      booleanFields: ['isInternal'],
      dateFields: ['createdAt', 'updatedAt'],
    });
  }

  // ============================================================================
  // VOTING
  // ============================================================================

  /**
   * Start voting phase for dispute
   */
  async startVoting(
    userId: string,
    disputeId: string,
    votingDeadline: Date,
    requiredVotes?: number,
  ): Promise<Dispute> {
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    if (membership.role !== 'admin' && membership.role !== 'treasurer') {
      throw new ForbiddenException('Only admin or treasurer can start voting');
    }

    const existingDispute = await this.getDispute(disputeId, userId);
    if (existingDispute.status !== DisputeStatus.DISCUSSION) {
      throw new BadRequestException('Can only start voting from discussion phase');
    }

    // Calculate required votes if not provided (simple majority of active members)
    if (!requiredVotes) {
      const memberCount = await this.db.query(
        `SELECT COUNT(*) as count FROM chama_members 
         WHERE chama_id = $1 AND status = 'active'`,
        [existingDispute.chamaId],
      );
      const totalMembers = parseInt(memberCount.rows[0]?.count || '0');
      requiredVotes = Math.ceil(totalMembers / 2); // Simple majority
    }

    const result = await this.db.query(
      `UPDATE disputes 
       SET status = $1, voting_deadline = $2, required_votes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [DisputeStatus.VOTING, votingDeadline, requiredVotes, disputeId],
    );

    const updatedDispute = mapQueryRow<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedDispute) {
      throw new NotFoundException('Dispute not found');
    }

    return updatedDispute;
  }

  /**
   * Cast a vote on dispute resolution
   */
  async castVote(
    userId: string,
    disputeId: string,
    dto: CastVoteDto,
  ): Promise<any> {
    // Verify access
    await this.verifyDisputeAccess(userId, disputeId);

    const dispute = await this.getDispute(disputeId, userId);
    if (dispute.status !== DisputeStatus.VOTING) {
      throw new BadRequestException('Dispute is not in voting phase');
    }

    if (dispute.votingDeadline && new Date(dispute.votingDeadline) < new Date()) {
      throw new BadRequestException('Voting deadline has passed');
    }

    // Check if user already voted
    const existingVote = await this.db.query(
      `SELECT id FROM dispute_votes WHERE dispute_id = $1 AND user_id = $2`,
      [disputeId, userId],
    );

    if (existingVote.rows.length > 0) {
      // Update existing vote
      const result = await this.db.query(
        `UPDATE dispute_votes 
         SET vote_type = $1, comment = $2, updated_at = CURRENT_TIMESTAMP
         WHERE dispute_id = $3 AND user_id = $4
         RETURNING *`,
        [dto.voteType, dto.comment || null, disputeId, userId],
      );
      return mapQueryRow<any>(result, {
        dateFields: ['createdAt', 'updatedAt'],
      });
    } else {
      // Create new vote
      const result = await this.db.query(
        `INSERT INTO dispute_votes (dispute_id, user_id, vote_type, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [disputeId, userId, dto.voteType, dto.comment || null],
      );
      return mapQueryRow<any>(result, {
        dateFields: ['createdAt', 'updatedAt'],
      });
    }
  }

  /**
   * Get all votes for a dispute
   */
  async getDisputeVotes(disputeId: string, userId: string): Promise<any[]> {
    await this.verifyDisputeAccess(userId, disputeId);

    const result = await this.db.query(
      `SELECT dv.*, u.full_name as user_name
       FROM dispute_votes dv
       JOIN users u ON dv.user_id = u.id
       WHERE dv.dispute_id = $1
       ORDER BY dv.created_at ASC`,
      [disputeId],
    );

    return mapQueryResult<any>(result, {
      dateFields: ['createdAt', 'updatedAt'],
    });
  }

  // ============================================================================
  // RESOLUTION
  // ============================================================================

  /**
   * Resolve a dispute
   */
  async resolveDispute(
    userId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    // Only admin or treasurer can resolve, or if voting passed
    const dispute = await this.getDispute(disputeId, userId);

    if (dispute.status === DisputeStatus.VOTING) {
      // Check if voting passed
      if (dispute.requiredVotes && dispute.votesFor < dispute.requiredVotes) {
        throw new BadRequestException('Voting has not passed. Cannot resolve dispute.');
      }
    } else if (membership.role !== 'admin' && membership.role !== 'treasurer') {
      throw new ForbiddenException('Only admin or treasurer can resolve disputes');
    }

    // Update dispute status
    const result = await this.db.query(
      `UPDATE disputes 
       SET status = $1, resolution_type = $2, resolution_details = $3,
           resolved_at = CURRENT_TIMESTAMP, resolved_by_user_id = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        DisputeStatus.RESOLVED,
        dto.resolutionType,
        JSON.stringify(dto.resolutionDetails),
        userId,
        disputeId,
      ],
    );

    const resolvedDispute = mapQueryRow<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });

    if (!resolvedDispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Create resolution record
    await this.db.query(
      `INSERT INTO dispute_resolutions (
        dispute_id, resolution_type, resolution_details, resolved_by_user_id,
        implementation_status, implementation_notes
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        disputeId,
        dto.resolutionType,
        JSON.stringify(dto.resolutionDetails),
        userId,
        'pending',
        dto.implementationNotes || null,
      ],
    );

    this.logger.log(`Dispute resolved: ${disputeId} by user ${userId}`);

    // Notify about resolution
    if (this.notificationService) {
      this.notificationService.notifyDisputeResolved(resolvedDispute).catch((err: any) => {
        this.logger.error(`Failed to send resolution notification: ${err.message}`);
      });
    }

    return resolvedDispute;
  }

  // ============================================================================
  // ESCALATION
  // ============================================================================

  /**
   * Escalate dispute to platform
   */
  async escalateDispute(
    userId: string,
    disputeId: string,
    dto: EscalateDisputeDto,
  ): Promise<any> {
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    // Only admin can escalate
    if (membership.role !== 'admin') {
      throw new ForbiddenException('Only admin can escalate disputes to platform');
    }

    const dispute = await this.getDispute(disputeId, userId);
    if (dispute.escalatedToPlatform) {
      throw new BadRequestException('Dispute is already escalated');
    }

    // Update dispute
    await this.db.query(
      `UPDATE disputes 
       SET status = $1, escalated_to_platform = TRUE, escalated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [DisputeStatus.ESCALATED, disputeId],
    );

    // Create escalation record
    const result = await this.db.query(
      `INSERT INTO dispute_escalations (
        dispute_id, escalated_by_user_id, escalation_reason, metadata
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        disputeId,
        userId,
        dto.escalationReason,
        JSON.stringify(dto.metadata || {}),
      ],
    );

    this.logger.log(`Dispute escalated: ${disputeId} by user ${userId}`);

    const escalation = mapQueryRow<any>(result, {
      dateFields: ['escalatedAt', 'platformReviewedAt'],
    });

    // Notify platform admins about escalation
    if (this.notificationService) {
      const dispute = await this.getDispute(disputeId, userId);
      this.notificationService.notifyDisputeEscalated(dispute).catch((err: any) => {
        this.logger.error(`Failed to send escalation notification: ${err.message}`);
      });
    }

    return escalation;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: string, userId: string): Promise<Dispute> {
    await this.verifyDisputeAccess(userId, disputeId);

    const result = await this.db.query(
      `SELECT d.*, 
              u1.full_name as filed_by_name,
              u2.full_name as filed_against_name,
              c.name as chama_name
       FROM disputes d
       LEFT JOIN users u1 ON d.filed_by_user_id = u1.id
       LEFT JOIN users u2 ON d.filed_against_user_id = u2.id
       LEFT JOIN chamas c ON d.chama_id = c.id
       WHERE d.id = $1`,
      [disputeId],
    );

    const dispute = mapQueryRow<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return dispute;
  }

  /**
   * Get disputes for a chama
   */
  async getChamaDisputes(
    chamaId: string,
    userId: string,
    status?: DisputeStatus,
    limit = 50,
    offset = 0,
  ): Promise<Dispute[]> {
    // Verify membership
    await this.verifyDisputeAccess(userId, chamaId);

    let query = `
      SELECT d.*, 
             u1.full_name as filed_by_name,
             u2.full_name as filed_against_name
      FROM disputes d
      LEFT JOIN users u1 ON d.filed_by_user_id = u1.id
      LEFT JOIN users u2 ON d.filed_against_user_id = u2.id
      WHERE d.chama_id = $1
    `;
    const params: any[] = [chamaId];

    if (status) {
      query += ` AND d.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return mapQueryResult<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get user's disputes (filed by or against)
   */
  async getUserDisputes(
    userId: string,
    chamaId?: string,
    status?: DisputeStatus,
  ): Promise<Dispute[]> {
    let query = `
      SELECT d.*, 
             u1.full_name as filed_by_name,
             u2.full_name as filed_against_name,
             c.name as chama_name
      FROM disputes d
      LEFT JOIN users u1 ON d.filed_by_user_id = u1.id
      LEFT JOIN users u2 ON d.filed_against_user_id = u2.id
      LEFT JOIN chamas c ON d.chama_id = c.id
      WHERE (d.filed_by_user_id = $1 OR d.filed_against_user_id = $1)
    `;
    const params: any[] = [userId];

    if (chamaId) {
      query += ` AND d.chama_id = $${params.length + 1}`;
      params.push(chamaId);
    }

    if (status) {
      query += ` AND d.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await this.db.query(query, params);

    return mapQueryResult<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Get dispute statistics for a chama
   */
  async getChamaDisputeStats(chamaId: string, userId: string): Promise<{
    total: number;
    active: number;
    resolved: number;
    escalated: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    await this.verifyDisputeAccess(userId, chamaId);

    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM disputes WHERE chama_id = $1`,
      [chamaId],
    );

    const activeResult = await this.db.query(
      `SELECT COUNT(*) as count FROM disputes 
       WHERE chama_id = $1 AND status IN ('filed', 'under_review', 'discussion', 'voting')`,
      [chamaId],
    );

    const resolvedResult = await this.db.query(
      `SELECT COUNT(*) as count FROM disputes 
       WHERE chama_id = $1 AND status = 'resolved'`,
      [chamaId],
    );

    const escalatedResult = await this.db.query(
      `SELECT COUNT(*) as count FROM disputes 
       WHERE chama_id = $1 AND escalated_to_platform = TRUE`,
      [chamaId],
    );

    const byTypeResult = await this.db.query(
      `SELECT dispute_type, COUNT(*) as count 
       FROM disputes WHERE chama_id = $1 
       GROUP BY dispute_type`,
      [chamaId],
    );

    const byStatusResult = await this.db.query(
      `SELECT status, COUNT(*) as count 
       FROM disputes WHERE chama_id = $1 
       GROUP BY status`,
      [chamaId],
    );

    return {
      total: parseInt(totalResult.rows[0]?.count || '0'),
      active: parseInt(activeResult.rows[0]?.count || '0'),
      resolved: parseInt(resolvedResult.rows[0]?.count || '0'),
      escalated: parseInt(escalatedResult.rows[0]?.count || '0'),
      byType: byTypeResult.rows.reduce((acc, row) => {
        acc[row.dispute_type] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Verify user has access to dispute (is member of chama)
   */
  private async verifyDisputeAccess(
    userId: string,
    disputeIdOrChamaId: string,
  ): Promise<{ id: string; role: string; status: string }> {
    // Check if it's a dispute ID or chama ID
    const disputeCheck = await this.db.query(
      `SELECT chama_id FROM disputes WHERE id = $1`,
      [disputeIdOrChamaId],
    );

    const chamaId = disputeCheck.rows.length > 0
      ? disputeCheck.rows[0].chama_id
      : disputeIdOrChamaId;

    const membership = await this.db.query(
      `SELECT id, role, status FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, userId],
    );

    if (membership.rows.length === 0) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    return membership.rows[0];
  }

  /**
   * Move dispute to discussion phase
   */
  async startDiscussion(
    userId: string,
    disputeId: string,
    discussionDeadline: Date,
  ): Promise<Dispute> {
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    if (membership.role !== 'admin' && membership.role !== 'treasurer') {
      throw new ForbiddenException('Only admin or treasurer can start discussion');
    }

    const existingDispute = await this.getDispute(disputeId, userId);
    if (existingDispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException('Can only start discussion from under_review status');
    }

    const result = await this.db.query(
      `UPDATE disputes 
       SET status = $1, discussion_deadline = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [DisputeStatus.DISCUSSION, discussionDeadline, disputeId],
    );

    const updatedDispute = mapQueryRow<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedDispute) {
      throw new NotFoundException('Dispute not found');
    }

    return updatedDispute;
  }

  /**
   * Update dispute status (admin/treasurer only)
   */
  async updateDisputeStatus(
    userId: string,
    disputeId: string,
    status: DisputeStatus,
  ): Promise<Dispute> {
    const membership = await this.verifyDisputeAccess(userId, disputeId);

    if (membership.role !== 'admin' && membership.role !== 'treasurer') {
      throw new ForbiddenException('Only admin or treasurer can update dispute status');
    }

    const result = await this.db.query(
      `UPDATE disputes 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, disputeId],
    );

    const updatedDispute = mapQueryRow<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });

    if (!updatedDispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Notify about status change
    if (this.notificationService) {
      const oldDispute = await this.getDispute(disputeId, userId);
      this.notificationService.notifyDisputeStatusChange(updatedDispute, oldDispute.status).catch((err: any) => {
        this.logger.error(`Failed to send status change notification: ${err.message}`);
      });
    }

    return updatedDispute;
  }

  // ============================================================================
  // ADMIN METHODS
  // ============================================================================

  /**
   * Get all escalated disputes (platform admin)
   */
  async getEscalatedDisputes(limit = 50, offset = 0): Promise<Dispute[]> {
    const result = await this.db.query(
      `SELECT d.*, 
              u1.full_name as filed_by_name,
              u2.full_name as filed_against_name,
              c.name as chama_name
       FROM disputes d
       LEFT JOIN users u1 ON d.filed_by_user_id = u1.id
       LEFT JOIN users u2 ON d.filed_against_user_id = u2.id
       LEFT JOIN chamas c ON d.chama_id = c.id
       WHERE d.escalated_to_platform = TRUE
       ORDER BY d.escalated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return mapQueryResult<Dispute>(result, {
      numberFields: ['amountDisputed', 'evidenceCount', 'commentCount', 'voteCount', 'votesFor', 'votesAgainst', 'votesAbstain', 'requiredVotes'],
      booleanFields: ['escalatedToPlatform'],
      dateFields: ['votingDeadline', 'discussionDeadline', 'resolvedAt', 'escalatedAt', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * Review escalated dispute (platform admin)
   */
  async reviewEscalatedDispute(
    adminUserId: string,
    disputeId: string,
    decision: string,
    platformAction?: Record<string, any>,
  ): Promise<any> {
    const dispute = await this.db.query(
      `SELECT * FROM disputes WHERE id = $1 AND escalated_to_platform = TRUE`,
      [disputeId],
    );

    if (dispute.rows.length === 0) {
      throw new NotFoundException('Escalated dispute not found');
    }

    // Update escalation record
    await this.db.query(
      `UPDATE dispute_escalations 
       SET platform_reviewed_at = CURRENT_TIMESTAMP,
           platform_reviewed_by = $1,
           platform_decision = $2,
           platform_action_taken = $3,
           status = 'reviewed'
       WHERE dispute_id = $4`,
      [adminUserId, decision, JSON.stringify(platformAction || {}), disputeId],
    );

    // Update dispute with platform resolution
    await this.db.query(
      `UPDATE disputes 
       SET platform_resolution = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [decision, disputeId],
    );

    return { success: true, message: 'Dispute reviewed successfully' };
  }

  /**
   * Get dispute analytics
   */
  async getDisputeAnalytics(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    resolutionRate: number;
    averageResolutionTime: number;
    escalationRate: number;
    trends: Array<{ date: string; count: number }>;
  }> {
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      dateFilter = `WHERE d.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      dateFilter = `WHERE d.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex += 1;
    } else if (endDate) {
      dateFilter = `WHERE d.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex += 1;
    }

    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM disputes d ${dateFilter}`,
      params,
    );

    const byTypeResult = await this.db.query(
      `SELECT dispute_type, COUNT(*) as count 
       FROM disputes d ${dateFilter}
       GROUP BY dispute_type`,
      params,
    );

    const byStatusResult = await this.db.query(
      `SELECT status, COUNT(*) as count 
       FROM disputes d ${dateFilter}
       GROUP BY status`,
      params,
    );

    const byPriorityResult = await this.db.query(
      `SELECT priority, COUNT(*) as count 
       FROM disputes d ${dateFilter}
       GROUP BY priority`,
      params,
    );

    const resolvedResult = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM disputes d 
       ${dateFilter} AND d.status = 'resolved'`,
      params,
    );

    const escalationResult = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM disputes d 
       ${dateFilter} AND d.escalated_to_platform = TRUE`,
      params,
    );

    const resolutionTimeResult = await this.db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400) as avg_days
       FROM disputes d
       ${dateFilter} AND d.status = 'resolved' AND d.resolved_at IS NOT NULL`,
      params,
    );

    const trendsResult = await this.db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM disputes d
       ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`,
      params,
    );

    const total = parseInt(totalResult.rows[0]?.count || '0');
    const resolved = parseInt(resolvedResult.rows[0]?.count || '0');
    const escalated = parseInt(escalationResult.rows[0]?.count || '0');

    return {
      total,
      byType: byTypeResult.rows.reduce((acc, row) => {
        acc[row.dispute_type] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      byPriority: byPriorityResult.rows.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
      averageResolutionTime: parseFloat(resolutionTimeResult.rows[0]?.avg_days || '0'),
      escalationRate: total > 0 ? (escalated / total) * 100 : 0,
      trends: trendsResult.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count),
      })),
    };
  }
}

