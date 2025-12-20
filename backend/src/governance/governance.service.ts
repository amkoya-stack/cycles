/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ActivityService,
  ActivityCategory,
  ActivityType,
} from '../activity/activity.service';
import {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
} from '../activity/notification.service';

export enum ProposalType {
  USE_FUNDS = 'use_funds',
  ACCEPT_MEMBER = 'accept_member',
  REJECT_MEMBER = 'reject_member',
  CHANGE_CONTRIBUTION = 'change_contribution',
  MAKE_INVESTMENT = 'make_investment',
  EXPEL_MEMBER = 'expel_member',
  UPDATE_CONSTITUTION = 'update_constitution',
  CHANGE_ROLE = 'change_role',
  APPROVE_LOAN = 'approve_loan',
  DISSOLVE_CHAMA = 'dissolve_chama',
  OTHER = 'other',
}

export enum VotingType {
  SIMPLE_MAJORITY = 'simple_majority',
  SUPERMAJORITY_66 = 'supermajority_66',
  SUPERMAJORITY_75 = 'supermajority_75',
  UNANIMOUS = 'unanimous',
  WEIGHTED_BY_ROLE = 'weighted_by_role',
  WEIGHTED_BY_CONTRIBUTION = 'weighted_by_contribution',
}

export enum VoteChoice {
  FOR = 'for',
  AGAINST = 'against',
  ABSTAIN = 'abstain',
}

export enum ProposalStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PASSED = 'passed',
  FAILED = 'failed',
  EXECUTED = 'executed',
  CANCELLED = 'cancelled',
}

@Injectable()
export class GovernanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new proposal
   */
  async createProposal(params: {
    chamaId: string;
    createdBy: string;
    proposalType: ProposalType;
    title: string;
    description: string;
    metadata?: Record<string, any>;
    votingType?: VotingType;
    requiredPercentage?: number;
    anonymous?: boolean;
    allowVoteChange?: boolean;
    deadlineHours?: number;
  }): Promise<any> {
    const {
      chamaId,
      createdBy,
      proposalType,
      title,
      description,
      metadata = {},
      votingType = VotingType.SIMPLE_MAJORITY,
      requiredPercentage = 50.01,
      anonymous = false,
      allowVoteChange = true,
      deadlineHours = 72, // Default 3 days
    } = params;

    // Verify user is a member
    await this.db.setSystemContext();
    const memberCheck = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, createdBy],
    );

    if (memberCheck.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Only active members can create proposals');
    }

    const userRole = memberCheck.rows[0].role;

    // Set required percentage based on voting type
    let finalPercentage = requiredPercentage;
    if (votingType === VotingType.SUPERMAJORITY_66) {
      finalPercentage = 66.67;
    } else if (votingType === VotingType.SUPERMAJORITY_75) {
      finalPercentage = 75.0;
    } else if (votingType === VotingType.UNANIMOUS) {
      finalPercentage = 100.0;
    }

    // Calculate deadline
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + deadlineHours);

    const result = await this.db.query(
      `INSERT INTO proposals (
        chama_id, created_by, proposal_type, title, description, metadata,
        voting_type, required_percentage, anonymous, allow_vote_change, deadline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING *`,
      [
        chamaId,
        createdBy,
        proposalType,
        title,
        description,
        JSON.stringify(metadata),
        votingType,
        finalPercentage,
        anonymous,
        allowVoteChange,
        deadline,
      ],
    );

    const proposal = result.rows[0];

    // Log activity
    const activityId = await this.activityService.createActivityLog({
      chamaId,
      userId: createdBy,
      category: ActivityCategory.GOVERNANCE,
      activityType: ActivityType.PROPOSAL_CREATED,
      title: `New Proposal: ${title}`,
      description: `${userRole} created a ${proposalType} proposal`,
      metadata: {
        proposalId: proposal.id,
        proposalType,
        votingType,
        deadline: deadline.toISOString(),
      },
      entityType: 'proposal',
      entityId: proposal.id,
    });

    // Notify all members
    await this.notificationService.notifyChamaMembers(
      chamaId,
      {
        title: `New Proposal: ${title}`,
        message: description,
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.HIGH,
        activityLogId: activityId,
      },
      createdBy,
    );

    await this.db.clearContext();
    return proposal;
  }

  /**
   * Cast a vote
   */
  async castVote(params: {
    proposalId: string;
    userId: string;
    vote: VoteChoice;
    reason?: string;
    delegateId?: string;
  }): Promise<any> {
    const { proposalId, userId, vote, reason, delegateId } = params;

    await this.db.setSystemContext();

    // Get proposal details
    const proposalResult = await this.db.query(
      `SELECT p.*, c.name as chama_name
       FROM proposals p
       JOIN chamas c ON p.chama_id = c.id
       WHERE p.id = $1`,
      [proposalId],
    );

    if (proposalResult.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalResult.rows[0];

    // Check if proposal is active
    if (proposal.status !== 'active') {
      await this.db.clearContext();
      throw new BadRequestException('Proposal is not active');
    }

    // Check if deadline has passed
    if (new Date() > new Date(proposal.deadline)) {
      await this.db.clearContext();
      throw new BadRequestException('Voting deadline has passed');
    }

    // Verify user is a member
    const memberCheck = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [proposal.chama_id, userId],
    );

    if (memberCheck.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Only active members can vote');
    }

    // Calculate vote weight
    const weightResult = await this.db.query(
      `SELECT calculate_vote_weight($1, $2, $3) as weight`,
      [proposal.voting_type, userId, proposal.chama_id],
    );
    const weight = weightResult.rows[0].weight;

    // Check if user already voted
    const existingVote = await this.db.query(
      `SELECT id FROM votes WHERE proposal_id = $1 AND user_id = $2`,
      [proposalId, userId],
    );

    let voteRecord;
    if (existingVote.rowCount > 0) {
      // Update existing vote if allowed
      if (!proposal.allow_vote_change) {
        await this.db.clearContext();
        throw new BadRequestException('Vote cannot be changed');
      }

      const updateResult = await this.db.query(
        `UPDATE votes
         SET vote = $1, weight = $2, delegate_id = $3, reason = $4, updated_at = NOW()
         WHERE proposal_id = $5 AND user_id = $6
         RETURNING *`,
        [vote, weight, delegateId, reason, proposalId, userId],
      );
      voteRecord = updateResult.rows[0];
    } else {
      // Insert new vote
      const insertResult = await this.db.query(
        `INSERT INTO votes (proposal_id, user_id, vote, weight, delegate_id, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [proposalId, userId, vote, weight, delegateId, reason],
      );
      voteRecord = insertResult.rows[0];
    }

    // Log activity (non-anonymous only)
    if (!proposal.anonymous) {
      await this.activityService.createActivityLog({
        chamaId: proposal.chama_id,
        userId: userId,
        category: ActivityCategory.GOVERNANCE,
        activityType: ActivityType.VOTE_CAST,
        title: `Vote Cast`,
        description: `Member voted ${vote} on proposal: ${proposal.title}`,
        metadata: {
          proposalId,
          vote,
          weight,
        },
        entityType: 'proposal',
        entityId: proposalId,
      });
    }

    await this.db.clearContext();
    return voteRecord;
  }

  /**
   * Get proposal details with votes and discussions
   */
  async getProposal(proposalId: string, userId: string): Promise<any> {
    await this.db.setUserContext(userId);

    const proposalResult = await this.db.query(
      `SELECT 
        p.*,
        u.full_name as creator_name,
        u.email as creator_email,
        c.name as chama_name,
        vr.total_votes_cast,
        vr.votes_for,
        vr.votes_against,
        vr.votes_abstain,
        vr.percentage_for,
        vr.percentage_against,
        vr.result
       FROM proposals p
       JOIN users u ON p.created_by = u.id
       JOIN chamas c ON p.chama_id = c.id
       LEFT JOIN voting_results vr ON p.id = vr.proposal_id
       WHERE p.id = $1`,
      [proposalId],
    );

    if (proposalResult.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalResult.rows[0];

    // Get user's vote if exists
    const userVoteResult = await this.db.query(
      `SELECT vote, reason, created_at, updated_at
       FROM votes
       WHERE proposal_id = $1 AND user_id = $2`,
      [proposalId, userId],
    );

    proposal.user_vote = userVoteResult.rows[0] || null;

    // Get votes (if not anonymous or proposal closed)
    if (!proposal.anonymous || proposal.status !== 'active') {
      const votesResult = await this.db.query(
        `SELECT v.*, u.full_name, u.email, u.profile_photo_url
         FROM votes v
         JOIN users u ON v.user_id = u.id
         WHERE v.proposal_id = $1
         ORDER BY v.created_at DESC`,
        [proposalId],
      );
      proposal.votes = votesResult.rows;
    } else {
      proposal.votes = [];
    }

    // Get discussions
    const discussionsResult = await this.db.query(
      `SELECT pd.*, u.full_name, u.profile_photo_url
       FROM proposal_discussions pd
       JOIN users u ON pd.user_id = u.id
       WHERE pd.proposal_id = $1
       ORDER BY pd.created_at ASC`,
      [proposalId],
    );
    proposal.discussions = discussionsResult.rows;

    await this.db.clearContext();
    return proposal;
  }

  /**
   * Get proposals for a chama
   */
  async getChamaProposals(params: {
    chamaId: string;
    userId: string;
    status?: ProposalStatus;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const { chamaId, userId, status, limit = 50, offset = 0 } = params;

    await this.db.setUserContext(userId);

    let query = `
      SELECT 
        p.*,
        u.full_name as creator_name,
        vr.total_votes_cast,
        vr.votes_for,
        vr.votes_against,
        vr.percentage_for,
        vr.result,
        (SELECT COUNT(*) FROM proposal_discussions WHERE proposal_id = p.id) as discussion_count,
        (SELECT vote FROM votes WHERE proposal_id = p.id AND user_id = $2) as user_vote
      FROM proposals p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN voting_results vr ON p.id = vr.proposal_id
      WHERE p.chama_id = $1
    `;

    const queryParams: any[] = [chamaId, userId];
    if (status) {
      query += ` AND p.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);

    await this.db.clearContext();
    return result.rows;
  }

  /**
   * Add discussion comment
   */
  async addDiscussion(params: {
    proposalId: string;
    userId: string;
    comment: string;
    parentId?: string;
  }): Promise<any> {
    const { proposalId, userId, comment, parentId } = params;

    await this.db.setSystemContext();

    // Verify proposal exists and is active
    const proposalCheck = await this.db.query(
      `SELECT chama_id, title, status FROM proposals WHERE id = $1`,
      [proposalId],
    );

    if (proposalCheck.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalCheck.rows[0];

    // Verify user is a member
    const memberCheck = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [proposal.chama_id, userId],
    );

    if (memberCheck.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Only members can comment');
    }

    const result = await this.db.query(
      `INSERT INTO proposal_discussions (proposal_id, user_id, comment, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [proposalId, userId, comment, parentId],
    );

    const discussion = result.rows[0];

    // Log activity
    await this.activityService.createActivityLog({
      chamaId: proposal.chama_id,
      userId,
      category: ActivityCategory.GOVERNANCE,
      activityType: ActivityType.COMMENT_ADDED,
      title: 'Discussion Comment',
      description: `Comment added to proposal: ${proposal.title}`,
      metadata: {
        proposalId,
        discussionId: discussion.id,
      },
      entityType: 'proposal',
      entityId: proposalId,
    });

    await this.db.clearContext();
    return discussion;
  }

  /**
   * Close proposal and calculate results
   */
  async closeProposal(proposalId: string, userId: string): Promise<any> {
    await this.db.setSystemContext();

    // Get proposal
    const proposalResult = await this.db.query(
      `SELECT p.*, c.name as chama_name
       FROM proposals p
       JOIN chamas c ON p.chama_id = c.id
       WHERE p.id = $1`,
      [proposalId],
    );

    if (proposalResult.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalResult.rows[0];

    // Verify user is admin or chairperson
    const memberCheck = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [proposal.chama_id, userId],
    );

    if (memberCheck.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Member not found');
    }

    const userRole = memberCheck.rows[0].role;
    if (!['admin', 'chairperson'].includes(userRole)) {
      await this.db.clearContext();
      throw new BadRequestException(
        'Only admin or chairperson can close proposals',
      );
    }

    // Call close function
    const resultQuery = await this.db.query(
      `SELECT close_proposal_and_calculate_results($1) as result`,
      [proposalId],
    );

    const votingResult = resultQuery.rows[0].result;

    // Get updated proposal with results
    const updatedProposal = await this.getProposal(proposalId, userId);

    // Log activity
    const activityId = await this.activityService.createActivityLog({
      chamaId: proposal.chama_id,
      userId,
      category: ActivityCategory.GOVERNANCE,
      activityType: ActivityType.PROPOSAL_CLOSED,
      title: `Proposal ${votingResult}`,
      description: `Proposal "${proposal.title}" was closed with result: ${votingResult}`,
      metadata: {
        proposalId,
        result: votingResult,
      },
      entityType: 'proposal',
      entityId: proposalId,
    });

    // Notify all members
    await this.notificationService.notifyChamaMembers(proposal.chama_id, {
      title: `Proposal ${votingResult}: ${proposal.title}`,
      message: `The vote has concluded with result: ${votingResult}`,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      activityLogId: activityId,
    });

    await this.db.clearContext();
    return updatedProposal;
  }

  /**
   * Execute a passed proposal
   */
  async executeProposal(
    proposalId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.db.setSystemContext();

    // Get proposal with results
    const proposalResult = await this.db.query(
      `SELECT p.*, vr.result
       FROM proposals p
       LEFT JOIN voting_results vr ON p.id = vr.proposal_id
       WHERE p.id = $1`,
      [proposalId],
    );

    if (proposalResult.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalResult.rows[0];

    // Verify proposal passed
    if (proposal.status !== 'passed') {
      await this.db.clearContext();
      throw new BadRequestException('Only passed proposals can be executed');
    }

    // Verify user is admin or chairperson
    const memberCheck = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [proposal.chama_id, userId],
    );

    if (memberCheck.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Member not found');
    }

    const userRole = memberCheck.rows[0].role;
    if (!['admin', 'chairperson'].includes(userRole)) {
      await this.db.clearContext();
      throw new BadRequestException(
        'Only admin or chairperson can execute proposals',
      );
    }

    let executionNotes = '';
    const metadata = proposal.metadata;

    // Execute based on proposal type
    try {
      switch (proposal.proposal_type) {
        case ProposalType.CHANGE_CONTRIBUTION:
          await this.db.query(
            `UPDATE chamas 
             SET contribution_amount = $1, contribution_frequency = $2
             WHERE id = $3`,
            [metadata.amount, metadata.frequency, proposal.chama_id],
          );
          executionNotes = `Changed contribution to ${metadata.amount} ${metadata.frequency}`;
          break;

        case ProposalType.CHANGE_ROLE:
          await this.db.query(
            `UPDATE chama_members
             SET role = $1
             WHERE chama_id = $2 AND user_id = $3`,
            [metadata.newRole, proposal.chama_id, metadata.memberId],
          );
          executionNotes = `Changed member role to ${metadata.newRole}`;
          break;

        case ProposalType.EXPEL_MEMBER:
          await this.db.query(
            `UPDATE chama_members
             SET status = 'expelled', left_at = NOW()
             WHERE chama_id = $1 AND user_id = $2`,
            [proposal.chama_id, metadata.memberId],
          );
          executionNotes = `Expelled member ${metadata.memberId}`;
          break;

        case ProposalType.ACCEPT_MEMBER:
          await this.db.query(
            `UPDATE join_requests
             SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
             WHERE id = $2`,
            [userId, metadata.requestId],
          );
          executionNotes = `Accepted new member`;
          break;

        case ProposalType.REJECT_MEMBER:
          await this.db.query(
            `UPDATE join_requests
             SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1
             WHERE id = $2`,
            [userId, metadata.requestId],
          );
          executionNotes = `Rejected member request`;
          break;

        default:
          executionNotes = 'Manual execution required';
      }

      // Update proposal status
      await this.db.query(
        `UPDATE proposals
         SET status = 'executed', updated_at = NOW()
         WHERE id = $1`,
        [proposalId],
      );

      // Update voting results
      await this.db.query(
        `UPDATE voting_results
         SET executed = true, executed_at = NOW(), execution_notes = $1
         WHERE proposal_id = $2`,
        [executionNotes, proposalId],
      );

      // Log activity
      await this.activityService.createActivityLog({
        chamaId: proposal.chama_id,
        userId,
        category: ActivityCategory.GOVERNANCE,
        activityType: ActivityType.PROPOSAL_EXECUTED,
        title: 'Proposal Executed',
        description: `Executed proposal: ${proposal.title}`,
        metadata: {
          proposalId,
          executionNotes,
        },
        entityType: 'proposal',
        entityId: proposalId,
      });

      await this.db.clearContext();
      return { success: true, message: executionNotes };
    } catch (error) {
      await this.db.clearContext();
      throw new BadRequestException(
        `Failed to execute proposal: ${error.message}`,
      );
    }
  }

  /**
   * Get voting statistics for a chama
   */
  async getVotingStats(chamaId: string, userId: string): Promise<any> {
    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT
        COUNT(*) as total_proposals,
        COUNT(*) FILTER (WHERE status = 'active') as active_proposals,
        COUNT(*) FILTER (WHERE status = 'passed') as passed_proposals,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_proposals,
        COUNT(*) FILTER (WHERE status = 'executed') as executed_proposals,
        ROUND(
          COUNT(*) FILTER (WHERE status IN ('passed', 'executed'))::DECIMAL / 
          NULLIF(COUNT(*) FILTER (WHERE status IN ('passed', 'failed', 'executed')), 0) * 100,
          2
        ) as success_rate
      FROM proposals
      WHERE chama_id = $1`,
      [chamaId],
    );

    await this.db.clearContext();
    return result.rows[0];
  }

  /**
   * Cancel a proposal (creator or admin only)
   */
  async cancelProposal(
    proposalId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db.setSystemContext();

    // Get proposal details
    const proposalResult = await this.db.query(
      `SELECT p.*, m.role
       FROM proposals p
       JOIN chama_members m ON p.chama_id = m.chama_id AND m.user_id = $2
       WHERE p.id = $1`,
      [proposalId, userId],
    );

    if (proposalResult.rowCount === 0) {
      await this.db.clearContext();
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalResult.rows[0];
    const isCreator = proposal.created_by === userId;
    const isAdmin = ['chairperson', 'secretary', 'treasurer'].includes(
      proposal.role,
    );

    if (!isCreator && !isAdmin) {
      await this.db.clearContext();
      throw new BadRequestException(
        'Only the creator or admins can cancel this proposal',
      );
    }

    // Can only cancel active or draft proposals
    if (!['active', 'draft'].includes(proposal.status)) {
      await this.db.clearContext();
      throw new BadRequestException(
        'Can only cancel active or draft proposals',
      );
    }

    // Update status to cancelled
    await this.db.query(
      `UPDATE proposals SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [proposalId],
    );

    // Log activity
    await this.activityService.createActivityLog({
      chamaId: proposal.chama_id,
      userId,
      category: ActivityCategory.GOVERNANCE,
      activityType: ActivityType.PROPOSAL_CANCELLED,
      title: `Proposal Cancelled: ${proposal.title}`,
      description: `${proposal.role} cancelled a ${proposal.proposal_type} proposal`,
      metadata: {
        proposalId,
        proposalType: proposal.proposal_type,
      },
      entityType: 'proposal',
      entityId: proposalId,
    });

    await this.db.clearContext();
    return { success: true };
  }
}
