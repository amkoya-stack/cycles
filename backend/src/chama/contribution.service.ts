/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { MpesaService } from '../mpesa/mpesa.service';
import { ReminderService } from './reminder.service';
import { ReputationAutomationService } from '../reputation/reputation-automation.service';
import {
  CreateContributionDto,
  ContributionHistoryQueryDto,
  SetupAutoDebitDto,
  UpdateAutoDebitDto,
  CreatePenaltyWaiverDto,
  VotePenaltyWaiverDto,
  PaymentMethod,
} from './dto/contribution.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ContributionService {
  private readonly logger = new Logger(ContributionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
    private readonly mpesa: MpesaService,
    @Inject(forwardRef(() => ReminderService))
    private readonly reminderService: ReminderService,
    private readonly reputationAutomation: ReputationAutomationService,
  ) {}

  /**
   * Create a contribution to a chama cycle
   */
  async createContribution(userId: string, dto: CreateContributionDto) {
    // Verify user is a member of the chama
    const memberCheck = await this.db.query(
      `SELECT cm.*, ch.contribution_amount, ch.settings 
       FROM chama_members cm
       JOIN chamas ch ON cm.chama_id = ch.id
       WHERE cm.chama_id = $1 AND cm.user_id = $2 AND cm.status = 'active'`,
      [dto.chamaId, userId],
    );

    if (memberCheck.rowCount === 0) {
      throw new BadRequestException(
        'You are not an active member of this chama',
      );
    }

    const member = memberCheck.rows[0];
    const settings = member.settings;

    // Verify cycle exists and is active
    const cycleCheck = await this.db.query(
      `SELECT * FROM contribution_cycles 
       WHERE id = $1 AND chama_id = $2 AND status = 'active'`,
      [dto.cycleId, dto.chamaId],
    );

    if (cycleCheck.rowCount === 0) {
      throw new NotFoundException('Contribution cycle not found or not active');
    }

    const cycle = cycleCheck.rows[0];

    // Check if user already contributed to this cycle
    const existingContribution = await this.db.query(
      `SELECT id FROM contributions 
       WHERE cycle_id = $1 AND user_id = $2 AND status = 'completed'`,
      [dto.cycleId, userId],
    );

    if (existingContribution.rowCount > 0) {
      throw new BadRequestException(
        'You have already contributed to this cycle',
      );
    }

    // Validate contribution amount based on chama settings
    const contributionType = settings.contribution_type || 'fixed';
    if (contributionType === 'fixed') {
      if (dto.amount !== parseFloat(member.contribution_amount)) {
        throw new BadRequestException(
          `Contribution amount must be exactly ${member.contribution_amount} for this chama`,
        );
      }
    } else if (contributionType === 'flexible') {
      const minAmount = parseFloat(
        settings.min_amount || member.contribution_amount,
      );
      const maxAmount = parseFloat(
        settings.max_amount || member.contribution_amount * 2,
      );
      if (dto.amount < minAmount || dto.amount > maxAmount) {
        throw new BadRequestException(
          `Contribution amount must be between ${minAmount} and ${maxAmount}`,
        );
      }
    }

    // Generate idempotency key
    const contributionId = uuidv4();
    const externalReference = `contribution-${contributionId}`;

    // Process payment based on method
    let transactionId: string | null = null;
    const feeAmount = 0;

    switch (dto.paymentMethod) {
      case PaymentMethod.WALLET:
        transactionId = await this.processWalletContribution(
          userId,
          dto.chamaId,
          dto.amount,
          member.id,
          cycle.cycle_number,
          externalReference,
        );
        break;

      case PaymentMethod.MPESA_DIRECT:
        if (!dto.mpesaPhone) {
          throw new BadRequestException(
            'M-Pesa phone number required for direct M-Pesa payment',
          );
        }
        transactionId = await this.processMpesaContribution(
          userId,
          dto.chamaId,
          dto.amount,
          dto.mpesaPhone,
          member.id,
        );
        break;

      case PaymentMethod.AUTO_DEBIT:
        throw new BadRequestException(
          'Auto-debit contributions are processed automatically',
        );

      default:
        throw new BadRequestException('Invalid payment method');
    }

    // Record the contribution with idempotency check
    const existingRecord = await this.db.query(
      `SELECT id FROM contributions WHERE id = $1`,
      [contributionId],
    );

    if (existingRecord.rowCount === 0) {
      await this.db.query(
        `INSERT INTO contributions (
          id, chama_id, cycle_id, member_id, user_id, 
          transaction_id, amount, fee_amount, payment_method,
          status, contributed_at, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', NOW(), $10)
        RETURNING *`,
        [
          contributionId,
          dto.chamaId,
          dto.cycleId,
          member.id,
          userId,
          transactionId,
          dto.amount,
          feeAmount,
          dto.paymentMethod,
          dto.notes,
        ],
      );
    }

    // Update cycle collected amount
    await this.db.query(
      `UPDATE contribution_cycles 
       SET collected_amount = collected_amount + $1,
           fees_collected = fees_collected + $2
       WHERE id = $3`,
      [dto.amount, feeAmount, dto.cycleId],
    );

    // Cancel pending reminders for this member
    if (this.reminderService) {
      await this.reminderService.cancelRemindersForMember(
        dto.cycleId,
        member.id,
      );
    }

    // Check if cycle is complete and trigger payout if configured
    await this.checkCycleCompletion(dto.cycleId);

    this.logger.log(
      `Contribution created: ${contributionId} for user ${userId}`,
    );

    return {
      contributionId,
      message: 'Contribution successful',
      amount: dto.amount,
      cycleNumber: cycle.cycle_number,
    };
  }

  /**
   * Process contribution from user wallet
   */
  private async processWalletContribution(
    userId: string,
    chamaId: string,
    amount: number,
    memberId: string,
    cycleNumber: number,
    externalReference: string,
  ): Promise<string> {
    // Use ledger service to process chama contribution
    const result = await this.ledger.processContribution(
      userId,
      chamaId,
      amount,
      `Contribution for cycle ${cycleNumber}`,
      externalReference,
    );

    return result.id;
  }

  /**
   * Process contribution via M-Pesa STK push
   */
  private async processMpesaContribution(
    userId: string,
    chamaId: string,
    amount: number,
    phoneNumber: string,
    memberId: string,
  ): Promise<string> {
    // Initiate M-Pesa STK push for the contribution
    const mpesaResult = await this.mpesa.stkPush({
      phoneNumber,
      amount,
      accountReference: `CHAMA-${chamaId.substring(0, 8)}`,
      transactionDesc: `Chama contribution`,
    });

    if (mpesaResult.responseCode !== '0') {
      throw new BadRequestException('Failed to initiate M-Pesa payment');
    }

    // Store pending contribution linked to M-Pesa transaction
    // This will be completed when M-Pesa callback is received
    return mpesaResult.checkoutRequestId;
  }

  /**
   * Get contribution history
   */
  async getContributionHistory(
    userId: string,
    query: ContributionHistoryQueryDto,
  ) {
    const { chamaId, cycleId, memberId, status, page = 1, limit = 50 } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE c.user_id = $1';
    const params: any[] = [userId];
    let paramCount = 1;

    if (chamaId) {
      whereClause += ` AND c.chama_id = $${++paramCount}`;
      params.push(chamaId);
    }

    if (cycleId) {
      whereClause += ` AND c.cycle_id = $${++paramCount}`;
      params.push(cycleId);
    }

    if (memberId) {
      whereClause += ` AND c.member_id = $${++paramCount}`;
      params.push(memberId);
    }

    if (status) {
      whereClause += ` AND c.status = $${++paramCount}`;
      params.push(status);
    }

    const result = await this.db.query(
      `SELECT 
        c.*,
        cy.cycle_number,
        cy.due_date,
        ch.name as chama_name,
        t.reference as transaction_reference
       FROM contributions c
       JOIN contribution_cycles cy ON c.cycle_id = cy.id
       JOIN chamas ch ON c.chama_id = ch.id
       LEFT JOIN transactions t ON c.transaction_id = t.id
       ${whereClause}
       ORDER BY c.contributed_at DESC
       LIMIT $${++paramCount} OFFSET $${++paramCount}`,
      [...params, limit, offset],
    );

    return {
      contributions: result.rows,
      total: result.rowCount,
      limit,
      offset,
    };
  }

  /**
   * Get cycle contribution summary
   */
  async getCycleContributionSummary(cycleId: string, userId: string) {
    // Verify user has access to this cycle
    const accessCheck = await this.db.query(
      `SELECT cy.* FROM contribution_cycles cy
       JOIN chama_members cm ON cy.chama_id = cm.chama_id
       WHERE cy.id = $1 AND cm.user_id = $2`,
      [cycleId, userId],
    );

    if (accessCheck.rowCount === 0) {
      throw new NotFoundException('Cycle not found or you do not have access');
    }

    const cycleData = accessCheck.rows[0];

    // Use the database function to get summary
    const summary = await this.db.query(
      'SELECT * FROM get_cycle_contribution_summary($1)',
      [cycleId],
    );

    // Get individual member statuses
    const memberStatuses = await this.db.query(
      `SELECT 
        cm.id as member_id,
        u.id as user_id,
        u.full_name,
        u.phone,
        CASE WHEN c.id IS NOT NULL THEN true ELSE false END as has_contributed,
        c.amount as contributed_amount,
        c.contributed_at,
        CASE 
          WHEN c.contributed_at IS NOT NULL AND c.contributed_at::DATE <= cy.due_date 
          THEN 'on_time'
          WHEN c.contributed_at IS NOT NULL 
          THEN 'late'
          ELSE 'pending'
        END as status
       FROM contribution_cycles cy
       JOIN chama_members cm ON cy.chama_id = cm.chama_id AND cm.status = 'active'
       JOIN users u ON cm.user_id = u.id
       LEFT JOIN contributions c ON c.cycle_id = cy.id AND c.member_id = cm.id AND c.status = 'completed'
       WHERE cy.id = $1
       ORDER BY u.full_name`,
      [cycleId],
    );

    const summaryData = summary.rows[0];

    const result = {
      cycle: {
        id: cycleData.id,
        cycleNumber: cycleData.cycle_number,
        expectedAmount:
          parseFloat(cycleData.expected_amount) * summaryData.total_members, // Total expected
        collectedAmount: parseFloat(summaryData.total_collected),
        dueDate: cycleData.due_date,
        status: cycleData.status,
        payout_executed_at: cycleData.payout_executed_at,
      },
      summary: {
        totalMembers: summaryData.total_members,
        contributedMembers: summaryData.contributed_members,
        pendingMembers: summaryData.pending_members,
        completionRate: parseFloat(summaryData.completion_rate) / 100, // Convert percentage to decimal
        totalCollected: parseFloat(summaryData.total_collected),
      },
      members: memberStatuses.rows.map((member) => ({
        memberId: member.member_id,
        userId: member.user_id,
        fullName: member.full_name,
        phone: member.phone,
        hasContributed: member.has_contributed,
        contributedAmount: member.contributed_amount,
        contributedAt: member.contributed_at,
        status: member.status,
      })),
    };

    console.log(
      'getCycleContributionSummary returning:',
      JSON.stringify(result, null, 2),
    );
    return result;
  }

  /**
   * Setup auto-debit for a member
   */
  async setupAutoDebit(userId: string, dto: SetupAutoDebitDto) {
    // Verify user is a member
    const memberCheck = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [dto.chamaId, userId],
    );

    if (memberCheck.rowCount === 0) {
      throw new BadRequestException(
        'You are not an active member of this chama',
      );
    }

    const memberId = memberCheck.rows[0].id;

    // Validate payment method
    if (dto.paymentMethod === PaymentMethod.MPESA_DIRECT && !dto.mpesaPhone) {
      throw new BadRequestException(
        'M-Pesa phone number required for M-Pesa auto-debit',
      );
    }

    if (dto.amountType === 'fixed' && !dto.fixedAmount) {
      throw new BadRequestException(
        'Fixed amount required when amount type is fixed',
      );
    }

    // Check if auto-debit already exists
    const existing = await this.db.query(
      'SELECT id FROM contribution_auto_debits WHERE member_id = $1',
      [memberId],
    );

    if (existing.rowCount > 0) {
      throw new BadRequestException(
        'Auto-debit already configured. Use update endpoint to modify.',
      );
    }

    // Calculate next execution date
    const nextExecution = this.calculateNextExecutionDate(dto.autoDebitDay);

    const result = await this.db.query(
      `INSERT INTO contribution_auto_debits (
        chama_id, member_id, user_id, enabled, payment_method,
        mpesa_phone, amount_type, fixed_amount, auto_debit_day,
        next_execution_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        dto.chamaId,
        memberId,
        userId,
        dto.enabled,
        dto.paymentMethod,
        dto.mpesaPhone,
        dto.amountType,
        dto.fixedAmount,
        dto.autoDebitDay,
        nextExecution,
      ],
    );

    return {
      autoDebitId: result.rows[0].id,
      message: 'Auto-debit setup successful',
      nextExecution,
    };
  }

  /**
   * Update auto-debit settings
   */
  async updateAutoDebit(
    userId: string,
    autoDebitId: string,
    dto: UpdateAutoDebitDto,
  ) {
    // Verify ownership
    const existing = await this.db.query(
      'SELECT * FROM contribution_auto_debits WHERE id = $1 AND user_id = $2',
      [autoDebitId, userId],
    );

    if (existing.rowCount === 0) {
      throw new NotFoundException('Auto-debit configuration not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (dto.enabled !== undefined) {
      updates.push(`enabled = $${++paramCount}`);
      values.push(dto.enabled);
    }

    if (dto.paymentMethod) {
      updates.push(`payment_method = $${++paramCount}`);
      values.push(dto.paymentMethod);
    }

    if (dto.mpesaPhone) {
      updates.push(`mpesa_phone = $${++paramCount}`);
      values.push(dto.mpesaPhone);
    }

    if (dto.amountType) {
      updates.push(`amount_type = $${++paramCount}`);
      values.push(dto.amountType);
    }

    if (dto.fixedAmount) {
      updates.push(`fixed_amount = $${++paramCount}`);
      values.push(dto.fixedAmount);
    }

    if (dto.autoDebitDay) {
      updates.push(`auto_debit_day = $${++paramCount}`);
      values.push(dto.autoDebitDay);

      // Recalculate next execution
      const nextExecution = this.calculateNextExecutionDate(dto.autoDebitDay);
      updates.push(`next_execution_at = $${++paramCount}`);
      values.push(nextExecution);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No updates provided');
    }

    values.push(autoDebitId);

    await this.db.query(
      `UPDATE contribution_auto_debits 
       SET ${updates.join(', ')}
       WHERE id = $${++paramCount}`,
      values,
    );

    return { message: 'Auto-debit updated successfully' };
  }

  /**
   * Get member's pending penalties
   */
  async getMemberPenalties(userId: string, chamaId?: string) {
    let whereClause = 'WHERE cp.user_id = $1';
    const params: any[] = [userId];

    if (chamaId) {
      whereClause += ' AND cp.chama_id = $2';
      params.push(chamaId);
    }

    const result = await this.db.query(
      `SELECT 
        cp.*,
        cy.cycle_number,
        cy.due_date,
        ch.name as chama_name
       FROM contribution_penalties cp
       JOIN contribution_cycles cy ON cp.cycle_id = cy.id
       JOIN chamas ch ON cp.chama_id = ch.id
       ${whereClause}
       ORDER BY cp.created_at DESC`,
      params,
    );

    return result.rows;
  }

  /**
   * Request penalty waiver
   */
  async requestPenaltyWaiver(userId: string, dto: CreatePenaltyWaiverDto) {
    // Verify penalty exists and belongs to user
    const penaltyCheck = await this.db.query(
      `SELECT cp.*, ch.id as chama_id
       FROM contribution_penalties cp
       JOIN chamas ch ON cp.chama_id = ch.id
       WHERE cp.id = $1 AND cp.user_id = $2 AND cp.status = 'pending'`,
      [dto.penaltyId, userId],
    );

    if (penaltyCheck.rowCount === 0) {
      throw new NotFoundException('Penalty not found or already resolved');
    }

    const penalty = penaltyCheck.rows[0];

    // Calculate votes needed (majority of active members)
    const memberCount = await this.db.query(
      "SELECT COUNT(*) as count FROM chama_members WHERE chama_id = $1 AND status = $'active'",
      [penalty.chama_id],
    );

    const votesNeeded = Math.ceil(parseInt(memberCount.rows[0].count) / 2);

    const result = await this.db.query(
      `INSERT INTO penalty_waiver_requests (
        penalty_id, requested_by, reason, votes_needed
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [dto.penaltyId, userId, dto.reason, votesNeeded],
    );

    return {
      waiverRequestId: result.rows[0].id,
      message: 'Penalty waiver request created',
      votesNeeded,
    };
  }

  /**
   * Vote on penalty waiver
   */
  async votePenaltyWaiver(userId: string, dto: VotePenaltyWaiverDto) {
    // Verify waiver request exists and get details
    const waiverCheck = await this.db.query(
      `SELECT wr.*, cp.chama_id
       FROM penalty_waiver_requests wr
       JOIN contribution_penalties cp ON wr.penalty_id = cp.id
       WHERE wr.id = $1 AND wr.status = 'pending'`,
      [dto.waiverRequestId],
    );

    if (waiverCheck.rowCount === 0) {
      throw new NotFoundException(
        'Waiver request not found or already resolved',
      );
    }

    const waiver = waiverCheck.rows[0];

    // Verify voter is a member of the chama
    const memberCheck = await this.db.query(
      "SELECT id FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND status = 'active'",
      [waiver.chama_id, userId],
    );

    if (memberCheck.rowCount === 0) {
      throw new BadRequestException(
        'You are not an active member of this chama',
      );
    }

    // Check if user already voted
    const existingVote = await this.db.query(
      'SELECT id FROM penalty_waiver_votes WHERE waiver_request_id = $1 AND voter_id = $2',
      [dto.waiverRequestId, userId],
    );

    if (existingVote.rowCount > 0) {
      throw new BadRequestException(
        'You have already voted on this waiver request',
      );
    }

    // Record the vote
    await this.db.query(
      `INSERT INTO penalty_waiver_votes (
        waiver_request_id, voter_id, vote, comment
      ) VALUES ($1, $2, $3, $4)`,
      [dto.waiverRequestId, userId, dto.vote, dto.comment],
    );

    // Count approve votes
    const voteCount = await this.db.query(
      `SELECT COUNT(*) as count FROM penalty_waiver_votes 
       WHERE waiver_request_id = $1 AND vote = 'approve'`,
      [dto.waiverRequestId],
    );

    const approveCount = parseInt(voteCount.rows[0].count);

    // Update votes received
    await this.db.query(
      'UPDATE penalty_waiver_requests SET votes_received = $1 WHERE id = $2',
      [approveCount, dto.waiverRequestId],
    );

    // Check if enough votes to approve
    if (approveCount >= waiver.votes_needed) {
      await this.db.query(
        `UPDATE penalty_waiver_requests 
         SET status = 'approved', resolved_at = NOW()
         WHERE id = $1`,
        [dto.waiverRequestId],
      );

      // Waive the penalty
      await this.db.query(
        `UPDATE contribution_penalties 
         SET status = 'waived', waived_by = $1, waived_at = NOW(), waiver_reason = $2
         WHERE id = $3`,
        [userId, 'Approved by member vote', waiver.penalty_id],
      );

      return { message: 'Penalty waiver approved', status: 'approved' };
    }

    return {
      message: 'Vote recorded',
      status: 'pending',
      votesReceived: approveCount,
      votesNeeded: waiver.votes_needed,
    };
  }

  /**
   * Check if cycle is complete and trigger payout if auto-payout enabled
   */
  private async checkCycleCompletion(cycleId: string) {
    const summary = await this.db.query(
      'SELECT * FROM get_cycle_contribution_summary($1)',
      [cycleId],
    );

    const { pending_members, total_members } = summary.rows[0];

    if (pending_members === 0 && total_members > 0) {
      // All members have contributed - mark cycle as complete
      const cycle = await this.db.query(
        `UPDATE contribution_cycles 
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1 
         RETURNING *`,
        [cycleId],
      );

      // Check if auto-payout is enabled
      const chamaSettings = await this.db.query(
        'SELECT settings FROM chamas WHERE id = $1',
        [cycle.rows[0].chama_id],
      );

      const settings = chamaSettings.rows[0].settings;
      if (settings.auto_payout) {
        await this.triggerAutoPayout(cycleId);
      }

      this.logger.log(
        `Cycle ${cycleId} completed with all contributions received`,
      );
    }
  }

  /**
   * Trigger automatic payout for completed cycle
   */
  private async triggerAutoPayout(cycleId: string) {
    const cycle = await this.db.query(
      'SELECT * FROM contribution_cycles WHERE id = $1',
      [cycleId],
    );

    if (cycle.rowCount === 0 || cycle.rows[0].payout_executed_at) {
      return; // Already paid out
    }

    const cycleData = cycle.rows[0];

    // Get next payout recipient
    const recipientId = await this.db.query(
      'SELECT get_next_payout_recipient($1) as recipient_id',
      [cycleData.chama_id],
    );

    if (!recipientId.rows[0].recipient_id) {
      this.logger.warn(`No payout recipient found for cycle ${cycleId}`);
      return;
    }

    // Process the payout through ledger
    const memberData = await this.db.query(
      'SELECT user_id FROM chama_members WHERE id = $1',
      [recipientId.rows[0].recipient_id],
    );

    const payoutExternalRef = `payout-cycle-${cycleId}`;
    await this.ledger.processPayout(
      cycleData.chama_id,
      memberData.rows[0].user_id,
      cycleData.collected_amount,
      `Payout for cycle ${cycleData.cycle_number}`,
      payoutExternalRef,
    );

    // Record payout (idempotent - only insert if not exists)
    await this.db.query(
      `INSERT INTO payouts (
        chama_id, cycle_id, recipient_member_id, recipient_user_id,
        amount, status, scheduled_at, executed_at
      ) 
      SELECT $1, $2, $3, $4, $5, 'completed', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM payouts WHERE cycle_id = $2
      )`,
      [
        cycleData.chama_id,
        cycleId,
        recipientId.rows[0].recipient_id,
        memberData.rows[0].user_id,
        cycleData.collected_amount,
      ],
    );

    // Update cycle with payout info
    await this.db.query(
      `UPDATE contribution_cycles 
       SET payout_recipient_id = $1, payout_amount = $2, payout_executed_at = NOW()
       WHERE id = $3`,
      [recipientId.rows[0].recipient_id, cycleData.collected_amount, cycleId],
    );

    this.logger.log(`Auto-payout executed for cycle ${cycleId}`);
  }

  /**
   * Calculate next execution date based on auto-debit day
   */
  private calculateNextExecutionDate(day: number): Date {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), day);

    // If the day has already passed this month, move to next month
    if (nextDate < now) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }
}
