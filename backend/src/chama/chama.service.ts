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
  externalReference?: string;
  coverImage?: string;
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
  coverImage?: string;
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
    try {
      console.log('Creating chama with dto:', JSON.stringify(dto, null, 2));

      // Idempotency check
      if (dto.externalReference) {
        const existing = await this.db.query(
          `SELECT id FROM chamas WHERE settings->>'externalReference' = $1`,
          [dto.externalReference],
        );
        if (existing.rowCount > 0) {
          console.log(
            'Chama already exists with externalReference:',
            dto.externalReference,
          );
          return this.getChamaDetails(adminUserId, existing.rows[0].id);
        }
      }

      // Validation
      if (dto.contributionAmount <= 0) {
        throw new BadRequestException(
          'Contribution amount must be greater than 0',
        );
      }

      const chamaId = uuidv4();

      // Generate tags based on chama settings
      const tags = this.generateChamaTags(dto);
      console.log('Generated tags:', tags);

      await this.db.transactionAsSystem(async (client) => {
        // Create chama
        const chamaResult = await client.query(
          `INSERT INTO chamas (
          id, name, description, admin_user_id, contribution_amount, 
          contribution_frequency, target_amount, max_members, settings, status, cover_image
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
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
            JSON.stringify({
              ...(dto.settings || {}),
              tags,
              externalReference: dto.externalReference,
            }),
            dto.coverImage || null,
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

      console.log('Chama created successfully, fetching details...');
      return this.getChamaDetails(adminUserId, chamaId);
    } catch (error) {
      console.error('Error creating chama:', error);
      throw error;
    }
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
        u.full_name as admin_name,
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

    // Check if current user is a member
    const memberCheck = await this.db.query(
      `SELECT role, status FROM chama_members WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    // Check if current user has a pending join request
    const pendingRequestCheck = await this.db.query(
      `SELECT id FROM chama_invites 
       WHERE chama_id = $1 AND invitee_user_id = $2 AND status = 'pending'`,
      [chamaId, userId],
    );

    const chama = result.rows[0];
    return {
      ...chama,
      tags: this.extractTagsFromSettings(chama.settings),
      type: chama.settings?.type || 'savings',
      lending_enabled: chama.settings?.lending_enabled || false,
      is_public: chama.settings?.visibility === 'public',
      user_role: memberCheck.rows[0]?.role || null,
      user_member_status: memberCheck.rows[0]?.status || null,
      is_member: memberCheck.rows.length > 0,
      has_pending_request: pendingRequestCheck.rows.length > 0,
    };
  }

  /**
   * Get public chama details (no auth required)
   */
  async getPublicChamaDetails(chamaId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        c.*,
        u.email as admin_email,
        u.phone as admin_phone,
        u.full_name as admin_name,
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

    if (result.rows.length === 0) {
      throw new NotFoundException('Chama not found');
    }

    const chama = result.rows[0];
    return {
      ...chama,
      tags: this.extractTagsFromSettings(chama.settings),
      type: chama.settings?.type || 'savings',
      lending_enabled: chama.settings?.lending_enabled || false,
      is_public: chama.settings?.visibility === 'public',
      // No user-specific fields for public access
      user_role: null,
      user_member_status: null,
      is_member: false,
    };
  }

  /**
   * Get public chama details by slug (no auth required)
   */
  async getPublicChamaDetailsBySlug(slug: string): Promise<any> {
    // Convert slug back to name (reverse the slug creation process)
    const decodedSlug = decodeURIComponent(slug);
    const possibleName = decodedSlug.replace(/-/g, ' ');

    const result = await this.db.query(
      `SELECT 
        c.*,
        u.email as admin_email,
        u.phone as admin_phone,
        u.full_name as admin_name,
        COUNT(DISTINCT cm.id) FILTER (WHERE cm.status = 'active') as active_members,
        COALESCE(SUM(cm.total_contributed), 0) as total_contributions,
        get_chama_balance(c.id) as current_balance
      FROM chamas c
      JOIN users u ON c.admin_user_id = u.id
      LEFT JOIN chama_members cm ON c.id = cm.chama_id
      WHERE c.status = 'active' 
        AND (c.settings->>'hidden' IS NULL OR c.settings->>'hidden' = 'false')
        AND (
          LOWER(c.name) = LOWER($1) OR 
          LOWER(REPLACE(c.name, ' ', '-')) = LOWER($2)
        )
      GROUP BY c.id, u.id`,
      [possibleName, decodedSlug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Chama not found');
    }

    const chama = result.rows[0];
    return {
      ...chama,
      tags: this.extractTagsFromSettings(chama.settings),
      type: chama.settings?.type || 'savings',
      lending_enabled: chama.settings?.lending_enabled || false,
      is_public: chama.settings?.visibility === 'public',
      // No user-specific fields for public access
      user_role: null,
      user_member_status: null,
      is_member: false,
    };
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
    if (dto.coverImage !== undefined) {
      console.log('Updating cover_image, length:', dto.coverImage?.length);
      updates.push(`cover_image = $${paramIndex++}`);
      values.push(dto.coverImage);
    }

    updates.push(`updated_at = NOW()`);
    values.push(chamaId);

    const query = `UPDATE chamas SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    console.log('Update query:', query);
    console.log(
      'Update values:',
      values.map(
        (v, i) =>
          `$${i + 1} = ${typeof v === 'string' ? v.substring(0, 50) : v}`,
      ),
    );

    await this.db.transactionAsSystem(async (client) => {
      const result = await client.query(query, values);
      console.log('Update result rowCount:', result.rowCount);
    });

    return this.getChamaDetails(userId, chamaId);
  }

  /**
   * Delete/close chama
   */
  async deleteChama(userId: string, chamaId: string): Promise<any> {
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin') {
      throw new ForbiddenException('Only admin can delete chama');
    }

    // Check if chama has balance
    const balance = await this.getChamaBalance(chamaId);
    if (balance > 0) {
      throw new BadRequestException(
        'Cannot delete chama with positive balance. Payout all funds first.',
      );
    }

    // Check if there are other active members
    const membersResult = await this.db.query(
      `SELECT COUNT(*) as count FROM chama_members 
       WHERE chama_id = $1 AND status = 'active' AND user_id != $2`,
      [chamaId, userId],
    );

    const otherMembersCount = parseInt(membersResult.rows[0].count);

    if (otherMembersCount > 0) {
      // If there are other members, just close it
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
    } else {
      // If admin is the only member, permanently delete
      await this.db.transactionAsSystem(async (client) => {
        // Delete chama members first (foreign key constraint)
        await client.query(`DELETE FROM chama_members WHERE chama_id = $1`, [
          chamaId,
        ]);

        // Delete the chama
        await client.query(`DELETE FROM chamas WHERE id = $1`, [chamaId]);
      });

      return { message: 'Chama deleted successfully' };
    }
  }

  /**
   * List user's chamas
   */
  async listUserChamas(userId: string): Promise<any> {
    console.log('Fetching chamas for user:', userId);

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

    console.log('User chamas query returned:', result.rowCount, 'rows');

    await this.db.clearContext();

    // Parse tags from settings JSONB
    return result.rows.map((row) => ({
      ...row,
      tags: this.extractTagsFromSettings(row.settings),
    }));
  }

  /**
   * List all chamas for browsing (both public and private are visible)
   * Public = anyone can join, Private = invite-only
   * To hide a chama completely, use settings.hidden = true
   */
  async listPublicChamas(): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        c.id,
        c.name,
        c.description,
        c.contribution_amount,
        c.contribution_frequency,
        c.max_members,
        c.activity_score,
        c.roi,
        c.cover_image,
        c.settings,
        c.created_at,
        COUNT(DISTINCT cm.id) FILTER (WHERE cm.status = 'active') as active_members,
        get_chama_balance(c.id) as current_balance
      FROM chamas c
      LEFT JOIN chama_members cm ON c.id = cm.chama_id
      WHERE c.status = 'active' 
        AND (c.settings->>'hidden' IS NULL OR c.settings->>'hidden' = 'false')
      GROUP BY c.id
      ORDER BY c.activity_score DESC, c.created_at DESC
      LIMIT 100`,
    );

    // Parse tags from settings JSONB
    return result.rows.map((row) => ({
      ...row,
      tags: this.extractTagsFromSettings(row.settings),
      is_public: true,
      type: row.settings?.type || 'savings',
      lending_enabled: row.settings?.lending_enabled || false,
    }));
  }

  /**
   * Extract tags from settings JSONB
   */
  private extractTagsFromSettings(settings: any): string[] {
    if (!settings) return [];

    // If settings is a string, parse it
    const parsedSettings =
      typeof settings === 'string' ? JSON.parse(settings) : settings;

    return parsedSettings.tags || [];
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
   * Join public chama (auto-accept without invitation)
   */
  async joinPublicChama(userId: string, chamaId: string): Promise<any> {
    // Check if chama exists and is public
    const chama = await this.db.query('SELECT * FROM chamas WHERE id = $1', [
      chamaId,
    ]);

    if (chama.rows.length === 0) {
      throw new NotFoundException('Chama not found');
    }

    const chamaData = chama.rows[0];
    const settings =
      typeof chamaData.settings === 'string'
        ? JSON.parse(chamaData.settings)
        : chamaData.settings;

    if (settings?.visibility !== 'public') {
      throw new BadRequestException(
        'This chama is private. You need an invitation to join.',
      );
    }

    // Check if already a member
    const existing = await this.db.query(
      'SELECT id FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [chamaId, userId],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException('You are already a member of this chama');
    }

    // Check max members
    const memberCount = await this.db.query(
      "SELECT COUNT(*) as count FROM chama_members WHERE chama_id = $1 AND status = 'active'",
      [chamaId],
    );

    if (parseInt(memberCount.rows[0].count) >= chamaData.max_members) {
      throw new BadRequestException('Chama has reached maximum members');
    }

    // Get next payout position
    const positionResult = await this.db.query(
      `SELECT COALESCE(MAX(payout_position), 0) + 1 as next_position
       FROM chama_members WHERE chama_id = $1`,
      [chamaId],
    );
    const nextPosition = positionResult.rows[0].next_position;

    await this.db.transactionAsSystem(async (client) => {
      // Add as member
      await client.query(
        `INSERT INTO chama_members (
          chama_id, user_id, role, status, payout_position
        ) VALUES ($1, $2, 'member', 'active', $3)`,
        [chamaId, userId, nextPosition],
      );
    });

    return { message: 'Successfully joined chama' };
  }

  /**
   * Request to join private chama
   */
  async requestToJoin(userId: string, chamaId: string): Promise<any> {
    // Check if chama exists
    const chama = await this.db.query('SELECT * FROM chamas WHERE id = $1', [
      chamaId,
    ]);

    if (chama.rows.length === 0) {
      throw new NotFoundException('Chama not found');
    }

    const chamaData = chama.rows[0];

    // Check if already a member
    const existing = await this.db.query(
      'SELECT id FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [chamaId, userId],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException('You are already a member of this chama');
    }

    // Check if there's already a pending request
    const pendingRequest = await this.db.query(
      `SELECT id FROM chama_invites 
       WHERE chama_id = $1 AND invitee_user_id = $2 AND status = 'pending'`,
      [chamaId, userId],
    );

    if (pendingRequest.rows.length > 0) {
      throw new BadRequestException(
        'You already have a pending request for this chama',
      );
    }

    // Get user details for the request
    const user = await this.db.query(
      'SELECT email, phone, full_name FROM users WHERE id = $1',
      [userId],
    );

    if (user.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const userData = user.rows[0];

    // Create join request (using the user as both requester and invitee)
    await this.db.query(
      `INSERT INTO chama_invites (
        chama_id, invited_by, invitee_user_id, invitee_email, invitee_phone, status
      ) VALUES ($1, $2, $2, $3, $4, 'pending')`,
      [chamaId, userId, userData.email, userData.phone],
    );

    return {
      message: 'Join request sent successfully. The admin will be notified.',
      chamaName: chamaData.name,
    };
  }

  /**
   * List pending join requests (admin only)
   */
  async listJoinRequests(userId: string, chamaId: string): Promise<any> {
    // Check if user is admin of this chama
    const member = await this.getMemberRole(userId, chamaId);
    if (member.role !== 'admin') {
      throw new ForbiddenException('Only admin can view join requests');
    }

    // Get pending join requests
    const requests = await this.db.query(
      `SELECT 
        ci.id,
        ci.invited_at,
        u.id as user_id,
        u.full_name,
        u.email,
        u.phone
      FROM chama_invites ci
      JOIN users u ON ci.invitee_user_id = u.id
      WHERE ci.chama_id = $1 
        AND ci.status = 'pending'
        AND ci.invited_by = ci.invitee_user_id -- Join requests where user invited themselves
      ORDER BY ci.invited_at DESC`,
      [chamaId],
    );

    return requests.rows;
  }

  /**
   * Respond to join request (admin only)
   */
  async respondToJoinRequest(
    adminId: string,
    inviteId: string,
    action: 'accept' | 'reject',
  ): Promise<any> {
    // Get the join request
    const invite = await this.db.query(
      `SELECT ci.*, c.id as chama_id, c.name as chama_name, c.max_members
       FROM chama_invites ci
       JOIN chamas c ON ci.chama_id = c.id
       WHERE ci.id = $1 AND ci.status = 'pending'`,
      [inviteId],
    );

    if (invite.rows.length === 0) {
      throw new NotFoundException(
        'Join request not found or already processed',
      );
    }

    const requestData = invite.rows[0];
    const chamaId = requestData.chama_id;
    const userId = requestData.invitee_user_id;

    // Check if admin has permission for this chama
    const member = await this.getMemberRole(adminId, chamaId);
    if (member.role !== 'admin') {
      throw new ForbiddenException('Only admin can respond to join requests');
    }

    if (action === 'accept') {
      // Check if chama has space
      const memberCount = await this.db.query(
        "SELECT COUNT(*) as count FROM chama_members WHERE chama_id = $1 AND status = 'active'",
        [chamaId],
      );

      if (parseInt(memberCount.rows[0].count) >= requestData.max_members) {
        throw new BadRequestException('Chama has reached maximum members');
      }

      // Get next payout position
      const positionResult = await this.db.query(
        `SELECT COALESCE(MAX(payout_position), 0) + 1 as next_position
         FROM chama_members WHERE chama_id = $1`,
        [chamaId],
      );
      const nextPosition = positionResult.rows[0].next_position;

      await this.db.transactionAsSystem(async (client) => {
        // Add as member
        await client.query(
          `INSERT INTO chama_members (
            chama_id, user_id, role, status, payout_position
          ) VALUES ($1, $2, 'member', 'active', $3)`,
          [chamaId, userId, nextPosition],
        );

        // Update invite status
        await client.query(
          `UPDATE chama_invites 
           SET status = 'accepted', responded_at = NOW()
           WHERE id = $1`,
          [inviteId],
        );
      });

      return {
        message: 'Join request accepted successfully',
        action: 'accepted',
      };
    } else {
      // Reject the request
      await this.db.query(
        `UPDATE chama_invites 
         SET status = 'rejected', responded_at = NOW()
         WHERE id = $1`,
        [inviteId],
      );

      return {
        message: 'Join request rejected',
        action: 'rejected',
      };
    }
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
        u.full_name,
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
        u.full_name,
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
        u.full_name,
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

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Generate tags/categories for chama based on settings
   */
  private generateChamaTags(dto: CreateChamaDto): string[] {
    const tags: string[] = [];
    const settings = dto.settings || {};

    // Type-based tags
    if (settings.type) {
      tags.push(settings.type);

      // Add specific type tags
      if (settings.type === 'savings' || settings.type === 'merry-go-round') {
        if (!settings.lending_enabled) {
          tags.push('savings-only');
        }
      }
      if (settings.type === 'investment') {
        tags.push('investment');
      }
      if (settings.type === 'lending' || settings.lending_enabled) {
        tags.push('lender');
      }
      if (settings.type === 'merry-go-round') {
        tags.push('rotating-buy');
      }
    }

    // Visibility tags
    if (settings.visibility === 'public') {
      tags.push('public');
    } else if (
      settings.visibility === 'private' ||
      settings.visibility === 'invite-only'
    ) {
      tags.push('private');
    }

    // Frequency tags
    if (dto.contributionFrequency === 'weekly') {
      tags.push('weekly');
    } else if (dto.contributionFrequency === 'biweekly') {
      tags.push('biweekly');
    } else if (dto.contributionFrequency === 'monthly') {
      tags.push('monthly');
    } else if (
      dto.contributionFrequency === 'custom' &&
      settings.frequency === 'daily'
    ) {
      tags.push('daily');
    }

    // Gender-specific tags (if specified in settings)
    if (settings.genderRestriction === 'women') {
      tags.push('women');
    } else if (settings.genderRestriction === 'men') {
      tags.push('men');
    }

    // Special category tags (if specified)
    if (settings.categories && Array.isArray(settings.categories)) {
      settings.categories.forEach((cat: string) => {
        if (!tags.includes(cat)) {
          tags.push(cat);
        }
      });
    }

    // Initial activity score (new chamas start lower)
    // This will be updated based on actual activity over time

    return tags;
  }

  /**
   * Get all co-members (users from chamas the current user is in)
   */
  async getCoMembers(userId: string) {
    // Get all chamas the user is a member of
    const userChamas = await this.db.query(
      `SELECT chama_id FROM chama_members WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );

    if (userChamas.rowCount === 0) {
      return [];
    }

    const chamaIds = userChamas.rows.map((row) => row.chama_id);

    // Get all members from these chamas, excluding the current user
    const coMembers = await this.db.query(
      `SELECT DISTINCT u.id, u.full_name, u.phone, u.email
       FROM users u
       INNER JOIN chama_members cm ON u.id = cm.user_id
       WHERE cm.chama_id = ANY($1)
         AND cm.status = 'active'
         AND u.id != $2
       ORDER BY u.full_name`,
      [chamaIds, userId],
    );

    return coMembers.rows;
  }

  /**
   * Leave chama with balance settlement
   */
  async leaveChama(userId: string, chamaId: string, dto: any): Promise<any> {
    // Validate permissions and membership
    const membership = await this.db.query(
      `SELECT role, status FROM chama_members WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    if (membership.rowCount === 0) {
      throw new BadRequestException('You are not a member of this chama');
    }

    const { role } = membership.rows[0];

    // Chairperson must transfer role before leaving
    if (role === 'chairperson') {
      throw new BadRequestException(
        'Chairperson must transfer role before leaving the chama',
      );
    }

    // Get member's financial status
    const memberAccount = await this.db.query(
      `SELECT id, balance FROM accounts WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, userId],
    );

    let memberBalance = 0;
    if (memberAccount.rowCount > 0) {
      memberBalance = parseFloat(memberAccount.rows[0].balance) || 0;
    }

    // Get total contributions and other metrics
    const contributionStats = await this.db.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_contributions,
        COUNT(*) as total_cycles_participated
       FROM contributions 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'completed'`,
      [chamaId, userId],
    );

    const totalContributions = parseFloat(
      contributionStats.rows[0]?.total_contributions || '0',
    );

    await this.db.transaction(async (client) => {
      // Handle balance settlement if member has outstanding balance
      if (memberBalance > 0 && dto.settlement) {
        const { method, withdrawal_address } = dto.settlement;

        if (method === 'forfeited') {
          // Distribute balance among remaining active members
          const activeMembers = await client.query(
            `SELECT user_id FROM chama_members 
             WHERE chama_id = $1 AND status = 'active' AND user_id != $2`,
            [chamaId, userId],
          );

          if (activeMembers.rowCount > 0) {
            const sharePerMember = memberBalance / activeMembers.rowCount;

            // Create ledger entries to distribute the forfeited balance
            for (const member of activeMembers.rows) {
              const memberAccountQuery = await client.query(
                `SELECT id FROM accounts WHERE chama_id = $1 AND user_id = $2`,
                [chamaId, member.user_id],
              );

              if (memberAccountQuery.rowCount > 0) {
                // TODO: Implement proper ledger distribution
                // For now, just log the distribution amount
                console.log(
                  `Would distribute ${sharePerMember} to member ${member.user_id}`,
                );
              }
            }
          }
        } else {
          // Transfer to specified method (wallet, mpesa, bank)
          // For now, transfer to user's main wallet
          const userWalletAccount = await client.query(
            `SELECT id FROM accounts WHERE user_id = $1 AND chama_id IS NULL AND status = 'active'`,
            [userId],
          );

          if (userWalletAccount.rowCount > 0 && memberBalance > 0) {
            // TODO: Implement proper ledger transfer using processTransfer
            // For now, just log the settlement
            console.log(
              `Would transfer ${memberBalance} to user wallet for user ${userId}`,
            );
          }
        }
      }

      // Update member status to 'left'
      await client.query(
        `UPDATE chama_members 
         SET status = 'left', left_at = NOW(), leave_reason = $3
         WHERE chama_id = $1 AND user_id = $2`,
        [chamaId, userId, dto.reason || null],
      );

      // Create role change audit record
      await client.query(
        `INSERT INTO role_change_audit (chama_id, member_id, old_role, new_role, changed_by, change_reason, change_type)
         VALUES ($1, $2, $3, NULL, $2, $4, 'member_leave')`,
        [chamaId, userId, role, dto.reason || 'Member left the chama'],
      );

      // Update chama member count
      await client.query(
        `UPDATE chamas 
         SET active_members = (
           SELECT COUNT(*) FROM chama_members 
           WHERE chama_id = $1 AND status = 'active'
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [chamaId],
      );
    });

    return {
      message: 'Successfully left the chama',
      settlement: {
        method: dto.settlement?.method || 'none',
        amount_settled: memberBalance,
        total_contributions: totalContributions,
      },
    };
  }
}
