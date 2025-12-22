/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
import { LedgerService } from '../ledger/ledger.service';

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
  TRANSFER_FUNDS = 'transfer_funds',
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
    @Inject(forwardRef(() => LedgerService))
    private readonly ledgerService: LedgerService,
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

    // Check if proposal has reached majority and should auto-execute
    await this.checkAndAutoExecuteProposal(proposalId, proposal, userId);

    await this.db.clearContext();
    return voteRecord;
  }

  /**
   * Check if proposal has reached majority and auto-execute if applicable
   */
  private async checkAndAutoExecuteProposal(
    proposalId: string,
    proposal: any,
    triggeredByUserId: string,
  ): Promise<void> {
    // Only auto-execute certain proposal types
    const autoExecutableTypes = [
      ProposalType.TRANSFER_FUNDS,
      ProposalType.ACCEPT_MEMBER,
      ProposalType.REJECT_MEMBER,
      ProposalType.CHANGE_CONTRIBUTION,
      ProposalType.CHANGE_ROLE,
      ProposalType.EXPEL_MEMBER,
    ];

    if (!autoExecutableTypes.includes(proposal.proposal_type)) {
      return;
    }

    // Get total eligible voters (active members)
    const membersResult = await this.db.query(
      `SELECT COUNT(*) as total FROM chama_members 
       WHERE chama_id = $1 AND status = 'active'`,
      [proposal.chama_id],
    );
    const totalEligible = parseInt(membersResult.rows[0].total, 10);

    // Get current vote counts
    const votesResult = await this.db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE vote = 'for') as votes_for,
         COUNT(*) FILTER (WHERE vote = 'against') as votes_against,
         COUNT(*) as total_votes
       FROM votes WHERE proposal_id = $1`,
      [proposalId],
    );

    const votesFor = parseInt(votesResult.rows[0].votes_for, 10);
    const votesAgainst = parseInt(votesResult.rows[0].votes_against, 10);
    const totalVotes = parseInt(votesResult.rows[0].total_votes, 10);

    // Calculate required threshold (50% + 1 = simple majority)
    const requiredVotes = Math.floor(totalEligible / 2) + 1;

    console.log(
      `Proposal ${proposalId}: ${votesFor} for, ${votesAgainst} against, ${requiredVotes} required of ${totalEligible} members`,
    );

    // Check if majority approved
    if (votesFor >= requiredVotes) {
      console.log(`Proposal ${proposalId} reached majority - auto-executing`);

      // Update proposal status to passed
      await this.db.query(
        `UPDATE proposals SET status = 'passed', updated_at = NOW() WHERE id = $1`,
        [proposalId],
      );

      // Store voting results
      await this.db.query(
        `INSERT INTO voting_results (
           proposal_id, total_eligible_voters, total_votes_cast,
           votes_for, votes_against, result, percentage_for, percentage_against
         ) VALUES ($1, $2, $3, $4, $5, 'passed', $6, $7)
         ON CONFLICT (proposal_id) DO UPDATE SET
           total_eligible_voters = EXCLUDED.total_eligible_voters,
           total_votes_cast = EXCLUDED.total_votes_cast,
           votes_for = EXCLUDED.votes_for,
           votes_against = EXCLUDED.votes_against,
           result = EXCLUDED.result,
           percentage_for = EXCLUDED.percentage_for,
           percentage_against = EXCLUDED.percentage_against`,
        [
          proposalId,
          totalEligible,
          totalVotes,
          votesFor,
          votesAgainst,
          totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0,
          totalVotes > 0 ? Math.round((votesAgainst / totalVotes) * 100) : 0,
        ],
      );

      // Auto-execute the proposal
      try {
        await this.executeProposalInternal(proposalId, triggeredByUserId);
        console.log(`Proposal ${proposalId} auto-executed successfully`);
      } catch (err) {
        console.error(`Failed to auto-execute proposal ${proposalId}:`, err);
        // Don't throw - the vote was still recorded
      }
    }
    // Check if majority rejected (can never pass)
    else if (votesAgainst >= requiredVotes) {
      console.log(`Proposal ${proposalId} rejected by majority`);

      // Update proposal status to failed
      await this.db.query(
        `UPDATE proposals SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [proposalId],
      );

      // Store voting results
      await this.db.query(
        `INSERT INTO voting_results (
           proposal_id, total_eligible_voters, total_votes_cast,
           votes_for, votes_against, result, percentage_for, percentage_against
         ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7)
         ON CONFLICT (proposal_id) DO UPDATE SET
           total_eligible_voters = EXCLUDED.total_eligible_voters,
           total_votes_cast = EXCLUDED.total_votes_cast,
           votes_for = EXCLUDED.votes_for,
           votes_against = EXCLUDED.votes_against,
           result = EXCLUDED.result,
           percentage_for = EXCLUDED.percentage_for,
           percentage_against = EXCLUDED.percentage_against`,
        [
          proposalId,
          totalEligible,
          totalVotes,
          votesFor,
          votesAgainst,
          totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0,
          totalVotes > 0 ? Math.round((votesAgainst / totalVotes) * 100) : 0,
        ],
      );
    }
  }

  /**
   * Internal method to execute proposal (without permission checks for auto-execution)
   */
  private async executeProposalInternal(
    proposalId: string,
    triggeredByUserId: string,
  ): Promise<void> {
    const proposalResult = await this.db.query(
      `SELECT * FROM proposals WHERE id = $1`,
      [proposalId],
    );

    if (proposalResult.rowCount === 0) {
      throw new BadRequestException('Proposal not found');
    }

    const proposal = proposalResult.rows[0];
    const metadata = proposal.metadata;
    let executionNotes = '';

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
          [triggeredByUserId, metadata.requestId],
        );
        executionNotes = `Accepted new member`;
        break;

      case ProposalType.REJECT_MEMBER:
        await this.db.query(
          `UPDATE join_requests
           SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1
           WHERE id = $2`,
          [triggeredByUserId, metadata.requestId],
        );
        executionNotes = `Rejected member request`;
        break;

      case ProposalType.TRANSFER_FUNDS:
        const transferResult = await this.ledgerService.processChamaTransfer({
          sourceChamaId: proposal.chama_id,
          destinationType: metadata.destinationType || 'chama',
          destinationChamaId: metadata.destinationChamaId,
          destinationUserId: metadata.destinationUserId,
          destinationPhone: metadata.destinationPhone,
          destinationBankName: metadata.destinationBankName,
          destinationAccountNumber: metadata.destinationAccountNumber,
          destinationAccountName: metadata.destinationAccountName,
          recipientName: metadata.recipientName,
          amount: metadata.amount,
          reason: metadata.reason || proposal.description,
          initiatedBy: triggeredByUserId,
          externalReference: `proposal-${proposalId}`,
        });

        await this.db.query(
          `UPDATE chama_transfers 
           SET proposal_id = $1, approved_at = NOW(), approved_by = $2, status = 'completed'
           WHERE transaction_id = $3`,
          [proposalId, triggeredByUserId, transferResult.transactionId],
        );

        const destType = metadata.destinationType || 'chama';
        let destLabel = metadata.recipientName || 'recipient';
        if (destType === 'mpesa')
          destLabel = metadata.destinationPhone || destLabel;
        else if (destType === 'bank')
          destLabel =
            `${metadata.destinationBankName} - ${metadata.destinationAccountNumber}` ||
            destLabel;
        else if (destType === 'chama')
          destLabel = metadata.destinationChamaName || destLabel;

        executionNotes = `Transferred KES ${metadata.amount.toLocaleString()} to ${destLabel} (${destType})`;
        break;

      default:
        executionNotes = 'Manual execution required';
        return; // Don't mark as executed for unknown types
    }

    // Update proposal status to executed
    await this.db.query(
      `UPDATE proposals
       SET status = 'executed', 
           execution_notes = $1,
           executed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [executionNotes, proposalId],
    );

    // Log the auto-execution
    await this.activityService.createActivityLog({
      chamaId: proposal.chama_id,
      userId: triggeredByUserId,
      category: ActivityCategory.GOVERNANCE,
      activityType: ActivityType.PROPOSAL_EXECUTED,
      title: 'Proposal Auto-Executed',
      description: `Proposal "${proposal.title}" was automatically executed after reaching majority approval. ${executionNotes}`,
      metadata: {
        proposalId,
        proposalType: proposal.proposal_type,
        executionNotes,
      },
      entityType: 'proposal',
      entityId: proposalId,
    });
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
    // Use system context to bypass RLS since we've already verified access
    if (!proposal.anonymous || proposal.status !== 'active') {
      await this.db.setSystemContext();
      const votesResult = await this.db.query(
        `SELECT v.*, u.full_name, u.email, u.profile_photo_url
         FROM votes v
         JOIN users u ON v.user_id = u.id
         WHERE v.proposal_id = $1
         ORDER BY v.created_at DESC`,
        [proposalId],
      );
      proposal.votes = votesResult.rows;
      await this.db.setUserContext(userId); // Restore user context
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
    includeCancelled?: boolean;
  }): Promise<any> {
    const {
      chamaId,
      userId,
      status,
      limit = 50,
      offset = 0,
      includeCancelled = false,
    } = params;

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

    // Exclude cancelled proposals by default
    if (!includeCancelled) {
      query += ` AND p.status != 'cancelled'`;
    }

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

        case ProposalType.TRANSFER_FUNDS:
          // Execute the transfer via ledger service (supports chama, user, mpesa, bank)
          const transferResult = await this.ledgerService.processChamaTransfer({
            sourceChamaId: proposal.chama_id,
            destinationType: metadata.destinationType || 'chama',
            // Chama destination
            destinationChamaId: metadata.destinationChamaId,
            // User destination
            destinationUserId: metadata.destinationUserId,
            // M-Pesa destination
            destinationPhone: metadata.destinationPhone,
            // Bank destination
            destinationBankName: metadata.destinationBankName,
            destinationAccountNumber: metadata.destinationAccountNumber,
            destinationAccountName: metadata.destinationAccountName,
            // Common fields
            recipientName: metadata.recipientName,
            amount: metadata.amount,
            reason: metadata.reason || proposal.description,
            initiatedBy: userId,
            externalReference: `proposal-${proposalId}`,
          });

          // Update the chama_transfers record with approval info
          await this.db.query(
            `UPDATE chama_transfers 
             SET proposal_id = $1, approved_at = NOW(), approved_by = $2, status = 'completed'
             WHERE transaction_id = $3`,
            [proposalId, userId, transferResult.transactionId],
          );

          // Format execution notes based on destination type
          const destType = metadata.destinationType || 'chama';
          let destLabel = metadata.recipientName || 'recipient';
          if (destType === 'mpesa')
            destLabel = metadata.destinationPhone || destLabel;
          else if (destType === 'bank')
            destLabel =
              `${metadata.destinationBankName} - ${metadata.destinationAccountNumber}` ||
              destLabel;
          else if (destType === 'chama')
            destLabel = metadata.destinationChamaName || destLabel;

          executionNotes = `Transferred KES ${metadata.amount.toLocaleString()} to ${destLabel} (${destType})`;
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
   * Check and execute all active proposals that have reached majority
   * This is useful for retroactively processing proposals that reached majority
   * before the auto-execute feature was implemented
   */
  async checkAndExecuteAllMajorityProposals(
    triggeredByUserId: string,
  ): Promise<{ processed: number; executed: string[]; failed: string[] }> {
    await this.db.setSystemContext();

    const executed: string[] = [];
    const failed: string[] = [];

    // First, execute any 'passed' proposals that haven't been executed yet
    const passedProposals = await this.db.query(
      `SELECT p.*, c.name as chama_name
       FROM proposals p
       JOIN chamas c ON p.chama_id = c.id
       WHERE p.status = 'passed'
         AND p.proposal_type IN ('transfer_funds', 'accept_member', 'reject_member', 'change_contribution', 'change_role', 'expel_member')`,
    );

    console.log(
      `Found ${passedProposals.rowCount} passed proposals awaiting execution`,
    );

    for (const proposal of passedProposals.rows) {
      try {
        console.log(
          `Executing passed proposal ${proposal.id} (${proposal.title})...`,
        );
        console.log('Proposal metadata:', JSON.stringify(proposal.metadata));
        await this.executeProposalInternal(proposal.id, triggeredByUserId);
        executed.push(proposal.id);
        console.log(`Proposal ${proposal.id} executed successfully`);
      } catch (err: any) {
        console.error(
          `Failed to execute passed proposal ${proposal.id}:`,
          err?.message || err,
        );
        console.error('Stack:', err?.stack);
        failed.push(proposal.id);
      }
    }

    // Then check all active proposals that could be auto-executed
    const activeProposals = await this.db.query(
      `SELECT p.*, c.name as chama_name,
              (SELECT COUNT(*) FROM chama_members WHERE chama_id = p.chama_id AND status = 'active') as total_members,
              (SELECT COUNT(*) FROM votes WHERE proposal_id = p.id AND vote = 'for') as votes_for,
              (SELECT COUNT(*) FROM votes WHERE proposal_id = p.id AND vote = 'against') as votes_against
       FROM proposals p
       JOIN chamas c ON p.chama_id = c.id
       WHERE p.status = 'active'
         AND p.proposal_type IN ('transfer_funds', 'accept_member', 'reject_member', 'change_contribution', 'change_role', 'expel_member')`,
    );

    console.log(
      `Found ${activeProposals.rowCount} active auto-executable proposals`,
    );

    for (const proposal of activeProposals.rows) {
      const totalMembers = parseInt(proposal.total_members, 10);
      const votesFor = parseInt(proposal.votes_for, 10);
      const votesAgainst = parseInt(proposal.votes_against, 10);
      const requiredVotes = Math.floor(totalMembers / 2) + 1;

      console.log(
        `Proposal ${proposal.id} (${proposal.title}): ${votesFor} for, ${votesAgainst} against, ${requiredVotes} required of ${totalMembers}`,
      );

      // Check if majority approved
      if (votesFor >= requiredVotes) {
        try {
          console.log(`Executing proposal ${proposal.id}...`);

          // Update to passed first
          await this.db.query(
            `UPDATE proposals SET status = 'passed', updated_at = NOW() WHERE id = $1`,
            [proposal.id],
          );

          // Store voting results
          const totalVotes = votesFor + votesAgainst;
          await this.db.query(
            `INSERT INTO voting_results (
               proposal_id, total_eligible_voters, total_votes_cast,
               votes_for, votes_against, result, percentage_for, percentage_against
             ) VALUES ($1, $2, $3, $4, $5, 'passed', $6, $7)
             ON CONFLICT (proposal_id) DO UPDATE SET
               total_eligible_voters = EXCLUDED.total_eligible_voters,
               total_votes_cast = EXCLUDED.total_votes_cast,
               votes_for = EXCLUDED.votes_for,
               votes_against = EXCLUDED.votes_against,
               result = EXCLUDED.result,
               percentage_for = EXCLUDED.percentage_for,
               percentage_against = EXCLUDED.percentage_against`,
            [
              proposal.id,
              totalMembers,
              totalVotes,
              votesFor,
              votesAgainst,
              totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0,
              totalVotes > 0
                ? Math.round((votesAgainst / totalVotes) * 100)
                : 0,
            ],
          );

          // Execute the proposal
          await this.executeProposalInternal(proposal.id, triggeredByUserId);
          executed.push(proposal.id);
          console.log(`Proposal ${proposal.id} executed successfully`);
        } catch (err) {
          console.error(`Failed to execute proposal ${proposal.id}:`, err);
          failed.push(proposal.id);
        }
      }
      // Check if majority rejected
      else if (votesAgainst >= requiredVotes) {
        try {
          console.log(`Marking proposal ${proposal.id} as failed...`);

          await this.db.query(
            `UPDATE proposals SET status = 'failed', updated_at = NOW() WHERE id = $1`,
            [proposal.id],
          );

          const totalVotes = votesFor + votesAgainst;
          await this.db.query(
            `INSERT INTO voting_results (
               proposal_id, total_eligible_voters, total_votes_cast,
               votes_for, votes_against, result, percentage_for, percentage_against
             ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7)
             ON CONFLICT (proposal_id) DO UPDATE SET
               total_eligible_voters = EXCLUDED.total_eligible_voters,
               total_votes_cast = EXCLUDED.total_votes_cast,
               votes_for = EXCLUDED.votes_for,
               votes_against = EXCLUDED.votes_against,
               result = EXCLUDED.result,
               percentage_for = EXCLUDED.percentage_for,
               percentage_against = EXCLUDED.percentage_against`,
            [
              proposal.id,
              totalMembers,
              totalVotes,
              votesFor,
              votesAgainst,
              totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0,
              totalVotes > 0
                ? Math.round((votesAgainst / totalVotes) * 100)
                : 0,
            ],
          );
          executed.push(proposal.id); // Count as processed
        } catch (err) {
          console.error(
            `Failed to mark proposal ${proposal.id} as failed:`,
            err,
          );
          failed.push(proposal.id);
        }
      }
    }

    await this.db.clearContext();

    return {
      processed: passedProposals.rowCount + activeProposals.rowCount,
      executed,
      failed,
    };
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

    // Check if this is a poll (polls can be deleted regardless of status)
    const isPoll = proposal.metadata?.isPoll === true;

    // Can only cancel active or draft proposals (unless it's a poll)
    if (!isPoll && !['active', 'draft'].includes(proposal.status)) {
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

    // Log activity (wrapped in try-catch to not fail the deletion)
    try {
      await this.activityService.createActivityLog({
        chamaId: proposal.chama_id,
        userId,
        category: ActivityCategory.GOVERNANCE,
        activityType: ActivityType.PROPOSAL_CANCELLED,
        title: isPoll
          ? `Poll Deleted: ${proposal.title}`
          : `Proposal Cancelled: ${proposal.title}`,
        description: isPoll
          ? `Poll was deleted by ${proposal.role}`
          : `${proposal.role} cancelled a ${proposal.proposal_type} proposal`,
        metadata: {
          proposalId,
          proposalType: proposal.proposal_type,
          isPoll,
        },
        entityType: 'proposal',
        entityId: proposalId,
      });
    } catch (activityError) {
      console.error(
        'Failed to log activity for proposal cancellation:',
        activityError,
      );
      // Continue - the proposal was already cancelled
    }

    await this.db.clearContext();
    return { success: true };
  }
}
