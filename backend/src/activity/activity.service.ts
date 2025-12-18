/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export enum ActivityCategory {
  FINANCIAL = 'financial',
  GOVERNANCE = 'governance',
  MEMBERSHIP = 'membership',
  DOCUMENT = 'document',
  SYSTEM = 'system',
}

export enum ActivityType {
  // Financial
  CONTRIBUTION_MADE = 'contribution_made',
  PAYOUT_DISBURSED = 'payout_disbursed',
  LOAN_ISSUED = 'loan_issued',
  LOAN_REPAID = 'loan_repaid',
  INVESTMENT_MADE = 'investment_made',
  INVESTMENT_RETURNED = 'investment_returned',
  FINE_APPLIED = 'fine_applied',
  FEE_CHARGED = 'fee_charged',

  // Governance
  VOTE_CREATED = 'vote_created',
  VOTE_CLOSED = 'vote_closed',
  VOTE_CAST = 'vote_cast',
  PROPOSAL_CREATED = 'proposal_created',
  PROPOSAL_APPROVED = 'proposal_approved',
  PROPOSAL_REJECTED = 'proposal_rejected',
  PROPOSAL_CLOSED = 'proposal_closed',
  PROPOSAL_EXECUTED = 'proposal_executed',
  COMMENT_ADDED = 'comment_added',
  SETTINGS_CHANGED = 'settings_changed',

  // Membership
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  MEMBER_REMOVED = 'member_removed',
  ROLE_CHANGED = 'role_changed',
  MEMBER_INVITED = 'member_invited',
  INVITE_ACCEPTED = 'invite_accepted',
  INVITE_REJECTED = 'invite_rejected',

  // Document
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_DELETED = 'document_deleted',
  DOCUMENT_SHARED = 'document_shared',

  // System
  ROTATION_CREATED = 'rotation_created',
  ROTATION_UPDATED = 'rotation_updated',
  CYCLE_COMPLETED = 'cycle_completed',
  REMINDER_SENT = 'reminder_sent',
  REPUTATION_CALCULATED = 'reputation_calculated',
}

interface CreateActivityLogParams {
  chamaId: string;
  userId?: string | null; // Null for system actions
  category: ActivityCategory;
  activityType: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
}

interface AddAuditTrailParams {
  activityLogId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
}

interface GetActivitiesParams {
  chamaId: string;
  category?: ActivityCategory;
  activityType?: ActivityType;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ActivityService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Create an activity log entry
   */
  async createActivityLog(params: CreateActivityLogParams): Promise<string> {
    const {
      chamaId,
      userId,
      category,
      activityType,
      title,
      description,
      metadata = {},
      entityType,
      entityId,
      ipAddress,
      userAgent,
      deviceInfo,
    } = params;

    // Use system context to bypass RLS
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `SELECT create_activity_log(
          $1::uuid, $2::uuid, $3::activity_category, $4::activity_type,
          $5, $6, $7::jsonb, $8, $9::uuid, $10::inet, $11, $12::jsonb
        ) as activity_id`,
        [
          chamaId,
          userId || null,
          category,
          activityType,
          title,
          description || null,
          JSON.stringify(metadata),
          entityType || null,
          entityId || null,
          ipAddress || null,
          userAgent || null,
          deviceInfo ? JSON.stringify(deviceInfo) : null,
        ],
      );

      return result.rows[0].activity_id;
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Add audit trail entry for an activity
   */
  async addAuditTrail(params: AddAuditTrailParams): Promise<string> {
    const { activityLogId, fieldName, oldValue, newValue } = params;

    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `SELECT add_audit_trail($1::uuid, $2, $3::jsonb, $4::jsonb) as audit_id`,
        [
          activityLogId,
          fieldName,
          JSON.stringify(oldValue),
          JSON.stringify(newValue),
        ],
      );

      return result.rows[0].audit_id;
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Create activity log with multiple audit trail entries
   */
  async createActivityWithAudit(
    activityParams: CreateActivityLogParams,
    changes: Array<{ field: string; oldValue: any; newValue: any }>,
  ): Promise<string> {
    const activityId = await this.createActivityLog(activityParams);

    // Add all audit trail entries
    await Promise.all(
      changes.map((change) =>
        this.addAuditTrail({
          activityLogId: activityId,
          fieldName: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
        }),
      ),
    );

    return activityId;
  }

  /**
   * Get activities for a chama with filters
   */
  async getActivities(params: GetActivitiesParams) {
    const {
      chamaId,
      category,
      activityType,
      userId,
      startDate,
      endDate,
      entityType,
      entityId,
      limit = 50,
      offset = 0,
    } = params;

    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.profile_photo_url as user_avatar
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.chama_id = $1
    `;
    const queryParams: any[] = [chamaId];
    let paramIndex = 2;

    if (category) {
      query += ` AND al.category = $${paramIndex}::activity_category`;
      queryParams.push(category);
      paramIndex++;
    }

    if (activityType) {
      query += ` AND al.activity_type = $${paramIndex}::activity_type`;
      queryParams.push(activityType);
      paramIndex++;
    }

    if (userId) {
      query += ` AND al.user_id = $${paramIndex}::uuid`;
      queryParams.push(userId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND al.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND al.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    if (entityType) {
      query += ` AND al.entity_type = $${paramIndex}`;
      queryParams.push(entityType);
      paramIndex++;
    }

    if (entityId) {
      query += ` AND al.entity_id = $${paramIndex}::uuid`;
      queryParams.push(entityId);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);
    return result.rows;
  }

  /**
   * Get activity details with audit trail
   */
  async getActivityDetails(activityId: string) {
    const activityResult = await this.db.query(
      `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.profile_photo_url as user_avatar
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1
      `,
      [activityId],
    );

    if (activityResult.rows.length === 0) {
      return null;
    }

    const activity = activityResult.rows[0];

    // Get audit trail
    const auditResult = await this.db.query(
      `
      SELECT *
      FROM audit_trails
      WHERE activity_log_id = $1
      ORDER BY created_at ASC
      `,
      [activityId],
    );

    return {
      ...activity,
      auditTrail: auditResult.rows,
    };
  }

  /**
   * Get activity count by category
   */
  async getActivityStats(chamaId: string, startDate?: Date, endDate?: Date) {
    let query = `
      SELECT 
        category,
        COUNT(*) as count
      FROM activity_logs
      WHERE chama_id = $1
    `;
    const params: any[] = [chamaId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY category`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Export activities to CSV format
   */
  async exportActivities(params: GetActivitiesParams): Promise<string> {
    const activities = await this.getActivities({ ...params, limit: 10000 });

    // CSV header
    let csv = 'Date,Category,Type,Title,Description,User,IP Address,Device\n';

    // CSV rows
    for (const activity of activities) {
      const row = [
        new Date(activity.created_at).toISOString(),
        activity.category,
        activity.activity_type,
        `"${activity.title.replace(/"/g, '""')}"`,
        `"${(activity.description || '').replace(/"/g, '""')}"`,
        activity.user_name || 'System',
        activity.ip_address || '',
        activity.device_info?.device || '',
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }
}
