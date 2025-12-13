/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationService } from '../wallet/notification.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateChamaDto {
  name: string;
  description?: string;
  contributionAmount: number;
  contributionFrequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  targetAmount?: number;
  maxMembers?: number;
  settings?: any;
}

export interface UpdateChamaDto {
  name?: string;
  description?: string;
  contributionAmount?: number;
  contributionFrequency?: string;
  targetAmount?: number;
  maxMembers?: number;
  settings?: any;
  status?: string;
}

export interface InviteMemberDto {
  phone?: string;
  email?: string;
  userId?: string;
}

export interface CreateCycleDto {
  expectedAmount: number;
  startDate: Date;
  dueDate: Date;
  payoutRecipientId?: string;
}

export interface ContributeDto {
  amount: number;
  notes?: string;
}

@Injectable()
export class ChamaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly notification: NotificationService,
  ) {}

  // ==========================================
  // CHAMA CORE OPERATIONS
  // ==========================================

  /**
   * Create a new chama
   */
  async createChama(adminUserId: string, dto: CreateChamaDto): Promise<any> {
    // Validation
    if (dto.contributionAmount <= 0) {
      throw new BadRequestException(
        'Contribution amount must be greater than 0',
      );
    }

    const chamaId = uuidv4();

    await this.db.transactionAsSystem(async (client) => {
      // Create chama
      const chamaResult = await client.query(
        `INSERT INTO chamas (
          id, name, description, admin_user_id, contribution_amount, 
          contribution_frequency, target_amount, max_members, settings, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
        RETURNING *`,
        [
          chamaId,
          dto.name,
          dto.description || null,
          adminUserId,
          dto.contributionAmount,
          dto.contributionFrequency,
          dto.targetAmount || 0,
          dto.maxMembers || 50,
          JSON.stringify(dto.settings || {}),
        ],
      );

      // Add admin as first member
      await client.query(
        `INSERT INTO chama_members (
          chama_id, user_id, role, status, payout_position
        ) VALUES ($1, $2, 'admin', 'active', 1)`,
        [chamaId, adminUserId],
      );

      // Create chama wallet via ledger
      await this.ledger.createChamaWallet(chamaId, dto.name);

      return chamaResult.rows[0];
    });

    return this.getChamaDetails(adminUserId, chamaId);
  }

  /**
   * Get chama details
   */
  async getChamaDetails(userId: string, chamaId: string): Promise<any> {
    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        c.*,
        u.email as admin_email,
        u.phone as admin_phone,
        u.first_name as admin_first_name,
        u.last_name as admin_last_name,
        COUNT(DISTINCT cm.id) FILTER (WHERE cm.status = 'active') as active_members,
        COALESCE(SUM(cm.total_contributed), 0) as total_contributions,
        get_chama_balance(c.id) as current_balance
      FROM chamas c
      JOIN users u ON c.admin_user_id = u.id
      LEFT JOIN chama_members cm ON c.id = cm.chama_id
      WHERE c.id = $1
      GROUP BY c.id, u.id`,
      [chamaId],
    );

    await this.db.clearContext();

    if (result.rows.length === 0) {
      throw new NotFoundException('Chama not found');
    }

    return result.rows[0];
  }

  /**
   * Update chama details
   */
  async updateChama(
    userId: string,
    chamaId: string,
    dto: UpdateChamaDto,
  ): Promise<any> {
    // Check if user is admin
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin') {
      throw new ForbiddenException('Only admin can update chama details');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.contributionAmount) {
      updates.push(`contribution_amount = $${paramIndex++}`);
      values.push(dto.contributionAmount);
    }
    if (dto.contributionFrequency) {
      updates.push(`contribution_frequency = $${paramIndex++}`);
      values.push(dto.contributionFrequency);
    }
    if (dto.targetAmount !== undefined) {
      updates.push(`target_amount = $${paramIndex++}`);
      values.push(dto.targetAmount);
    }
    if (dto.maxMembers) {
      updates.push(`max_members = $${paramIndex++}`);
      values.push(dto.maxMembers);
    }
    if (dto.settings) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(dto.settings));
    }
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }

    updates.push(`updated_at = NOW()`);
    values.push(chamaId);

    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `UPDATE chamas SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values,
      );
    });

    return this.getChamaDetails(userId, chamaId);
  }

  /**
   * Delete/close chama
   */
  async deleteChama(userId: string, chamaId: string): Promise<any> {
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin') {
      throw new ForbiddenException('Only admin can close chama');
    }

    // Check if chama has balance
    const balance = await this.getChamaBalance(chamaId);
    if (balance > 0) {
      throw new BadRequestException(
        'Cannot close chama with positive balance. Payout all funds first.',
      );
    }

    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `UPDATE chamas SET status = 'closed', closed_at = NOW() WHERE id = $1`,
        [chamaId],
      );

      // Mark all members as left
      await client.query(
        `UPDATE chama_members SET status = 'left', left_at = NOW() WHERE chama_id = $1`,
        [chamaId],
      );
    });

    return { message: 'Chama closed successfully' };
  }

  /**
   * List user's chamas
   */
  async listUserChamas(userId: string): Promise<any> {
    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        c.*,
        cm.role,
        cm.status as member_status,
        cm.total_contributed,
        cm.total_received,
        COUNT(DISTINCT cm2.id) FILTER (WHERE cm2.status = 'active') as active_members,
        get_chama_balance(c.id) as current_balance
      FROM chamas c
      JOIN chama_members cm ON c.id = cm.chama_id
      LEFT JOIN chama_members cm2 ON c.id = cm2.chama_id
      WHERE cm.user_id = $1 AND cm.status = 'active'
      GROUP BY c.id, cm.id
      ORDER BY c.created_at DESC`,
      [userId],
    );

    await this.db.clearContext();

    return result.rows;
  }

  // ==========================================
  // MEMBER MANAGEMENT
  // ==========================================

  /**
   * Invite member to chama
   */
  async inviteMember(
    userId: string,
    chamaId: string,
    dto: InviteMemberDto,
  ): Promise<any> {
    // Check if user is admin or treasurer
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin' && member.role !== 'treasurer') {
      throw new ForbiddenException(
        'Only admin or treasurer can invite members',
      );
    }

    // Check if already member
    if (dto.userId) {
      const existing = await this.db.query(
        'SELECT id FROM chama_members WHERE chama_id = $1 AND user_id = $2',
        [chamaId, dto.userId],
      );
      if (existing.rows.length > 0) {
        throw new BadRequestException('User is already a member');
      }
    }

    // Check max members
    const chama = await this.getChamaDetails(userId, chamaId);
    if (chama.active_members >= chama.max_members) {
      throw new BadRequestException('Chama has reached maximum members');
    }

    const inviteId = uuidv4();

    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `INSERT INTO chama_invites (
          id, chama_id, invited_by, invitee_phone, invitee_email, invitee_user_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [
          inviteId,
          chamaId,
          userId,
          dto.phone || null,
          dto.email || null,
          dto.userId || null,
        ],
      );
    });

    // Send invitation notification
    if (dto.phone) {
      await this.notification.sendSMSReceipt({
        phoneNumber: dto.phone,
        message: `You've been invited to join ${chama.name} chama. Reply to accept.`,
      });
    }

    return { inviteId, message: 'Invitation sent successfully' };
  }

  /**
   * Accept invitation
   */
  async acceptInvite(userId: string, inviteId: string): Promise<any> {
    const invite = await this.db.query(
      'SELECT * FROM chama_invites WHERE id = $1',
      [inviteId],
    );

    if (invite.rows.length === 0) {
      throw new NotFoundException('Invitation not found');
    }

    const inviteData = invite.rows[0];

    if (inviteData.status !== 'pending') {
      throw new BadRequestException('Invitation already responded to');
    }

    if (new Date(inviteData.expires_at) < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Get next payout position
    const positionResult = await this.db.query(
      `SELECT COALESCE(MAX(payout_position), 0) + 1 as next_position
       FROM chama_members WHERE chama_id = $1`,
      [inviteData.chama_id],
    );
    const nextPosition = positionResult.rows[0].next_position;

    await this.db.transactionAsSystem(async (client) => {
      // Add as member
      await client.query(
        `INSERT INTO chama_members (
          chama_id, user_id, role, status, payout_position
        ) VALUES ($1, $2, 'member', 'active', $3)`,
        [inviteData.chama_id, userId, nextPosition],
      );

      // Update invite
      await client.query(
        `UPDATE chama_invites SET status = 'accepted', responded_at = NOW()
         WHERE id = $1`,
        [inviteId],
      );
    });

    return { message: 'Successfully joined chama' };
  }

  /**
   * Remove member from chama
   */
  async removeMember(
    userId: string,
    chamaId: string,
    memberUserId: string,
  ): Promise<any> {
    const requester = await this.getMemberRole(userId, chamaId);
    if (requester.role !== 'admin') {
      throw new ForbiddenException('Only admin can remove members');
    }

    const member = await this.db.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [chamaId, memberUserId],
    );

    if (member.rows.length === 0) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove admin
    if (member.rows[0].role === 'admin') {
      throw new BadRequestException('Cannot remove chama admin');
    }

    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `UPDATE chama_members SET status = 'left', left_at = NOW()
         WHERE chama_id = $1 AND user_id = $2`,
        [chamaId, memberUserId],
      );
    });

    return { message: 'Member removed successfully' };
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    userId: string,
    chamaId: string,
    memberUserId: string,
    newRole: string,
  ): Promise<any> {
    const requester = await this.getMemberRole(userId, chamaId);
    if (requester.role !== 'admin') {
      throw new ForbiddenException('Only admin can update roles');
    }

    if (!['admin', 'treasurer', 'member'].includes(newRole)) {
      throw new BadRequestException('Invalid role');
    }

    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `UPDATE chama_members SET role = $1 WHERE chama_id = $2 AND user_id = $3`,
        [newRole, chamaId, memberUserId],
      );
    });

    return { message: 'Role updated successfully' };
  }

  /**
   * List chama members
   */
  async listMembers(userId: string, chamaId: string): Promise<any> {
    // Verify user is member
    await this.getMemberRole(userId, chamaId);

    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        cm.*,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        calculate_contribution_rate(cm.id) as contribution_rate
      FROM chama_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chama_id = $1 AND cm.status = 'active'
      ORDER BY cm.payout_position`,
      [chamaId],
    );

    await this.db.clearContext();

    return result.rows;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Get member role in chama
   */
  private async getMemberRole(userId: string, chamaId: string): Promise<any> {
    const result = await this.db.query(
      "SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND status = 'active'",
      [chamaId, userId],
    );

    if (result.rows.length === 0) {
      throw new ForbiddenException('You are not a member of this chama');
    }

    return result.rows[0];
  }

  /**
   * Get chama balance
   */
  async getChamaBalance(chamaId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT get_chama_balance($1) as balance',
      [chamaId],
    );
    return parseFloat(result.rows[0].balance) || 0;
  }

  // ==========================================
  // CONTRIBUTION CYCLES
  // ==========================================

  /**
   * Create contribution cycle
   */
  async createContributionCycle(
    userId: string,
    chamaId: string,
    dto: CreateCycleDto,
  ): Promise<any> {
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin' && member.role !== 'treasurer') {
      throw new ForbiddenException('Only admin or treasurer can create cycles');
    }

    // Get next cycle number
    const cycleResult = await this.db.query(
      `SELECT COALESCE(MAX(cycle_number), 0) + 1 as next_cycle
       FROM contribution_cycles WHERE chama_id = $1`,
      [chamaId],
    );
    const cycleNumber = cycleResult.rows[0].next_cycle;

    const cycleId = uuidv4();

    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `INSERT INTO contribution_cycles (
          id, chama_id, cycle_number, expected_amount, start_date, due_date,
          payout_recipient_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [
          cycleId,
          chamaId,
          cycleNumber,
          dto.expectedAmount,
          dto.startDate,
          dto.dueDate,
          dto.payoutRecipientId || null,
        ],
      );
    });

    return { cycleId, cycleNumber, message: 'Cycle created successfully' };
  }

  /**
   * Get active cycle
   */
  async getActiveCycle(userId: string, chamaId: string): Promise<any> {
    await this.getMemberRole(userId, chamaId);

    const result = await this.db.query(
      `SELECT * FROM contribution_cycles
       WHERE chama_id = $1 AND status = 'active'
       ORDER BY cycle_number DESC LIMIT 1`,
      [chamaId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get cycle history
   */
  async getCycleHistory(userId: string, chamaId: string): Promise<any> {
    await this.getMemberRole(userId, chamaId);

    const result = await this.db.query(
      `SELECT * FROM contribution_cycles
       WHERE chama_id = $1
       ORDER BY cycle_number DESC`,
      [chamaId],
    );

    return result.rows;
  }

  // ==========================================
  // CONTRIBUTIONS
  // ==========================================

  /**
   * Contribute to chama
   */
  async contributeToChama(
    userId: string,
    chamaId: string,
    cycleId: string,
    dto: ContributeDto,
  ): Promise<any> {
    const member = await this.getMemberRole(userId, chamaId);

    // Validate cycle
    const cycle = await this.db.query(
      'SELECT * FROM contribution_cycles WHERE id = $1 AND chama_id = $2',
      [cycleId, chamaId],
    );

    if (cycle.rows.length === 0) {
      throw new NotFoundException('Cycle not found');
    }

    if (cycle.rows[0].status !== 'active') {
      throw new BadRequestException('Cycle is not active');
    }

    // Check if already contributed
    const existing = await this.db.query(
      "SELECT id FROM contributions WHERE cycle_id = $1 AND member_id = $2 AND status = 'completed'",
      [cycleId, member.id],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException('Already contributed to this cycle');
    }

    // Process contribution through ledger (includes 4.5% fee)
    const transaction = await this.ledger.processContribution(
      userId,
      chamaId,
      dto.amount,
      dto.notes || `Contribution for cycle ${cycle.rows[0].cycle_number}`,
    );

    const feeAmount = (dto.amount * 4.5) / 100;

    // Record contribution
    const contributionId = uuidv4();
    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `INSERT INTO contributions (
          id, chama_id, cycle_id, member_id, user_id, transaction_id,
          amount, fee_amount, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)`,
        [
          contributionId,
          chamaId,
          cycleId,
          member.id,
          userId,
          transaction.id,
          dto.amount,
          feeAmount,
          dto.notes || null,
        ],
      );

      // Update cycle collected amount
      await client.query(
        `UPDATE contribution_cycles
         SET collected_amount = collected_amount + $1,
             fees_collected = fees_collected + $2
         WHERE id = $3`,
        [dto.amount, feeAmount, cycleId],
      );

      // Update member total contributed
      await client.query(
        `UPDATE chama_members
         SET total_contributed = total_contributed + $1,
             last_contribution_at = NOW()
         WHERE id = $2`,
        [dto.amount, member.id],
      );
    });

    // Send notification to member
    const chama = await this.getChamaDetails(userId, chamaId);
    await this.notification.sendSMSReceipt({
      phoneNumber: member.phone || '',
      message: `Contribution of KES ${dto.amount} to ${chama.name} received. Fee: KES ${feeAmount.toFixed(2)}`,
    });

    return {
      contributionId,
      message: 'Contribution successful',
      amount: dto.amount,
      fee: feeAmount,
    };
  }

  /**
   * Get contribution history
   */
  async getContributionHistory(userId: string, chamaId: string): Promise<any> {
    await this.getMemberRole(userId, chamaId);

    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        c.*,
        u.first_name,
        u.last_name,
        u.phone,
        cy.cycle_number,
        cy.due_date
      FROM contributions c
      JOIN users u ON c.user_id = u.id
      JOIN contribution_cycles cy ON c.cycle_id = cy.id
      WHERE c.chama_id = $1
      ORDER BY c.contributed_at DESC`,
      [chamaId],
    );

    await this.db.clearContext();

    return result.rows;
  }

  /**
   * Get member contributions
   */
  async getMemberContributions(
    userId: string,
    chamaId: string,
    memberUserId: string,
  ): Promise<any> {
    await this.getMemberRole(userId, chamaId);

    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        c.*,
        cy.cycle_number,
        cy.due_date,
        cy.expected_amount
      FROM contributions c
      JOIN contribution_cycles cy ON c.cycle_id = cy.id
      WHERE c.chama_id = $1 AND c.user_id = $2
      ORDER BY c.contributed_at DESC`,
      [chamaId, memberUserId],
    );

    await this.db.clearContext();

    return result.rows;
  }

  // ==========================================
  // PAYOUTS
  // ==========================================

  /**
   * Execute payout for cycle
   */
  async executePayoutCycle(
    userId: string,
    chamaId: string,
    cycleId: string,
  ): Promise<any> {
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin' && member.role !== 'treasurer') {
      throw new ForbiddenException(
        'Only admin or treasurer can execute payouts',
      );
    }

    // Get cycle
    const cycle = await this.db.query(
      'SELECT * FROM contribution_cycles WHERE id = $1 AND chama_id = $2',
      [cycleId, chamaId],
    );

    if (cycle.rows.length === 0) {
      throw new NotFoundException('Cycle not found');
    }

    const cycleData = cycle.rows[0];

    if (cycleData.status !== 'active') {
      throw new BadRequestException('Cycle is not active');
    }

    if (cycleData.payout_executed_at) {
      throw new BadRequestException('Payout already executed');
    }

    // Determine recipient
    let recipientMemberId = cycleData.payout_recipient_id;
    if (!recipientMemberId) {
      // Use rotation logic
      const nextRecipient = await this.db.query(
        'SELECT get_next_payout_recipient($1) as member_id',
        [chamaId],
      );
      recipientMemberId = nextRecipient.rows[0].member_id;
    }

    if (!recipientMemberId) {
      throw new BadRequestException('No eligible recipient found');
    }

    // Get recipient details
    const recipient = await this.db.query(
      'SELECT * FROM chama_members WHERE id = $1',
      [recipientMemberId],
    );
    const recipientData = recipient.rows[0];

    // Use collected amount for payout
    const payoutAmount = parseFloat(cycleData.collected_amount);

    if (payoutAmount <= 0) {
      throw new BadRequestException('No funds to payout');
    }

    // Process payout through ledger
    const transaction = await this.ledger.processPayout(
      chamaId,
      recipientData.user_id,
      payoutAmount,
      `Payout for cycle ${cycleData.cycle_number}`,
    );

    // Record payout
    const payoutId = uuidv4();
    await this.db.transactionAsSystem(async (client) => {
      await client.query(
        `INSERT INTO payouts (
          id, chama_id, cycle_id, recipient_member_id, recipient_user_id,
          transaction_id, amount, status, scheduled_at, executed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW(), NOW())`,
        [
          payoutId,
          chamaId,
          cycleId,
          recipientMemberId,
          recipientData.user_id,
          transaction.id,
          payoutAmount,
        ],
      );

      // Update cycle
      await client.query(
        `UPDATE contribution_cycles
         SET payout_amount = $1, payout_executed_at = NOW(),
             status = 'completed', completed_at = NOW()
         WHERE id = $2`,
        [payoutAmount, cycleId],
      );

      // Update member total received
      await client.query(
        `UPDATE chama_members
         SET total_received = total_received + $1
         WHERE id = $2`,
        [payoutAmount, recipientMemberId],
      );
    });

    // Send notification
    const chama = await this.getChamaDetails(userId, chamaId);
    await this.notification.sendSMSReceipt({
      phoneNumber: recipientData.phone || '',
      message: `Payout of KES ${payoutAmount} from ${chama.name} has been sent to your wallet.`,
    });

    return {
      payoutId,
      message: 'Payout executed successfully',
      amount: payoutAmount,
      recipient: recipientData.user_id,
    };
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(userId: string, chamaId: string): Promise<any> {
    await this.getMemberRole(userId, chamaId);

    await this.db.setUserContext(userId);

    const result = await this.db.query(
      `SELECT 
        p.*,
        u.first_name,
        u.last_name,
        u.phone,
        cy.cycle_number
      FROM payouts p
      JOIN users u ON p.recipient_user_id = u.id
      JOIN contribution_cycles cy ON p.cycle_id = cy.id
      WHERE p.chama_id = $1
      ORDER BY p.executed_at DESC`,
      [chamaId],
    );

    await this.db.clearContext();

    return result.rows;
  }
}
