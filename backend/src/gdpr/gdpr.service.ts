import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TokenizationService } from '../common/services/tokenization.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly tokenization: TokenizationService,
  ) {}

  /**
   * Export user data (GDPR right to data portability)
   */
  async exportUserData(
    userId: string,
    exportType: 'full' | 'partial' = 'full',
    fieldsRequested?: string[],
  ): Promise<{ requestId: string; status: string }> {
    // Check for existing pending request
    const existing = await this.db.query(
      `SELECT id FROM data_export_requests 
       WHERE user_id = $1 AND status IN ('pending', 'processing')`,
      [userId],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException(
        'You already have a data export request in progress',
      );
    }

    // Create export request
    const requestId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    await this.db.query(
      `INSERT INTO data_export_requests 
       (id, user_id, request_type, fields_requested, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [
        requestId,
        userId,
        exportType,
        fieldsRequested || null,
        expiresAt,
      ],
    );

    // Process export asynchronously (in production, use a queue)
    this.processExport(requestId, userId, exportType, fieldsRequested).catch(
      (error) => {
        this.logger.error(`Failed to process export ${requestId}:`, error);
      },
    );

    return { requestId, status: 'pending' };
  }

  /**
   * Process data export
   */
  private async processExport(
    requestId: string,
    userId: string,
    exportType: string,
    fieldsRequested?: string[],
  ): Promise<void> {
    try {
      // Update status to processing
      await this.db.query(
        `UPDATE data_export_requests SET status = 'processing' WHERE id = $1`,
        [requestId],
      );

      // Collect user data
      const userData: any = {};

      // Basic user info
      const userResult = await this.db.query(
        `SELECT id, email, phone, full_name, dob, bio, created_at, updated_at
         FROM users WHERE id = $1`,
        [userId],
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        // Detokenize sensitive fields
        userData.user = {
          id: user.id,
          email: user.email ? await this.tokenization.detokenize(user.email, 'email') : null,
          phone: user.phone ? await this.tokenization.detokenize(user.phone, 'phone') : null,
          fullName: user.full_name,
          dob: user.dob,
          bio: user.bio,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        };
      }

      // Chama memberships
      const chamasResult = await this.db.query(
        `SELECT c.id, c.name, c.slug, cm.role, cm.status, cm.joined_at
         FROM chama_members cm
         JOIN chamas c ON cm.chama_id = c.id
         WHERE cm.user_id = $1`,
        [userId],
      );
      userData.chamas = chamasResult.rows;

      // Transactions
      const transactionsResult = await this.db.query(
        `SELECT id, type, amount, status, description, created_at
         FROM financial_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId],
      );
      userData.transactions = transactionsResult.rows;

      // Loans
      const loansResult = await this.db.query(
        `SELECT id, amount, interest_rate, status, created_at, due_date
         FROM loans
         WHERE borrower_user_id = $1
         ORDER BY created_at DESC`,
        [userId],
      );
      userData.loans = loansResult.rows;

      // Create export file (JSON)
      const exportDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const fileName = `export_${userId}_${Date.now()}.json`;
      const filePath = path.join(exportDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));

      // In production, upload to S3 and get URL
      const fileUrl = `/exports/${fileName}`;

      // Update request with file URL
      await this.db.query(
        `UPDATE data_export_requests 
         SET status = 'completed', file_url = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [fileUrl, requestId],
      );

      this.logger.log(`Data export completed for user ${userId}`);
    } catch (error) {
      await this.db.query(
        `UPDATE data_export_requests SET status = 'failed' WHERE id = $1`,
        [requestId],
      );
      throw error;
    }
  }

  /**
   * Request data deletion (GDPR right to be forgotten)
   */
  async requestDataDeletion(
    userId: string,
    reason?: string,
  ): Promise<{ requestId: string; status: string }> {
    // Check for existing pending request
    const existing = await this.db.query(
      `SELECT id FROM data_deletion_requests 
       WHERE user_id = $1 AND status = 'pending'`,
      [userId],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException(
        'You already have a data deletion request pending',
      );
    }

    // Create deletion request
    const requestId = uuidv4();

    await this.db.query(
      `INSERT INTO data_deletion_requests 
       (id, user_id, reason, status)
       VALUES ($1, $2, $3, 'pending')`,
      [requestId, userId, reason || null],
    );

    this.logger.warn(`Data deletion requested for user ${userId}`);

    return { requestId, status: 'pending' };
  }

  /**
   * Approve data deletion request (admin only)
   */
  async approveDataDeletion(
    requestId: string,
    approvedByUserId: string,
    scheduleDeletion: boolean = true,
  ): Promise<void> {
    const request = await this.db.query(
      `SELECT user_id, status FROM data_deletion_requests WHERE id = $1`,
      [requestId],
    );

    if (request.rows.length === 0) {
      throw new NotFoundException('Deletion request not found');
    }

    if (request.rows[0].status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const userId = request.rows[0].user_id;
    const deletionDate = scheduleDeletion
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      : new Date();

    await this.db.query(
      `UPDATE data_deletion_requests 
       SET status = 'approved', approved_by_user_id = $1, approved_at = CURRENT_TIMESTAMP,
           deletion_scheduled_at = $2
       WHERE id = $3`,
      [approvedByUserId, deletionDate, requestId],
    );

    if (!scheduleDeletion) {
      // Delete immediately
      await this.deleteUserData(userId);
    }

    this.logger.warn(`Data deletion approved for user ${userId} by ${approvedByUserId}`);
  }

  /**
   * Delete user data (anonymize or hard delete based on retention policy)
   */
  private async deleteUserData(userId: string): Promise<void> {
    // In production, implement proper data deletion:
    // 1. Anonymize personal data (replace with pseudonyms)
    // 2. Delete or anonymize transactions (may need to keep for compliance)
    // 3. Delete documents
    // 4. Delete sessions
    // 5. Keep audit logs (required for compliance)

    // For now, we'll mark user as deleted and anonymize sensitive fields
    await this.db.query(
      `UPDATE users 
       SET email = NULL, phone = NULL, full_name = 'Deleted User', 
           id_number = NULL, deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId],
    );

    // Delete sessions
    await this.db.query(
      `UPDATE user_sessions SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1`,
      [userId],
    );

    // Delete KYC documents (in production, also delete files from storage)
    await this.db.query(
      `UPDATE kyc_documents SET verification_status = 'expired' WHERE user_id = $1`,
      [userId],
    );

    // Mark deletion as completed
    await this.db.query(
      `UPDATE data_deletion_requests 
       SET status = 'completed', deletion_completed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId],
    );

    this.logger.warn(`User data deleted for user ${userId}`);
  }

  /**
   * Log data access (for GDPR compliance)
   */
  async logDataAccess(
    accessedByUserId: string,
    targetUserId?: string,
    targetChamaId?: string,
    accessType: string = 'view_profile',
    resourceType?: string,
    resourceId?: string,
    ipAddress?: string,
    userAgent?: string,
    accessGranted: boolean = true,
    reason?: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO data_access_logs 
       (accessed_by_user_id, target_user_id, target_chama_id, access_type, 
        resource_type, resource_id, ip_address, user_agent, access_granted, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        accessedByUserId,
        targetUserId || null,
        targetChamaId || null,
        accessType,
        resourceType || null,
        resourceId || null,
        ipAddress || null,
        userAgent || null,
        accessGranted,
        reason || null,
      ],
    );
  }

  /**
   * Get export request status
   */
  async getExportStatus(requestId: string, userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM data_export_requests 
       WHERE id = $1 AND user_id = $2`,
      [requestId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Export request not found');
    }

    return result.rows[0];
  }
}

