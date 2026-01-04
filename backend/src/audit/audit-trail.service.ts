import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogContext {
  userId?: string;
  chamaId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionId?: string;
  complianceRequired?: boolean;
}

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Log activity with complete context
   */
  async logActivity(
    action: string,
    entityType: string,
    entityId: string | null,
    context: AuditLogContext,
    details?: Record<string, any>,
  ): Promise<string> {
    const logId = uuidv4();

    // Validate entityId is a valid UUID if provided
    let validEntityId: string | null = null;
    if (entityId) {
      // Check if it's a valid UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(entityId)) {
        validEntityId = entityId;
      } else {
        // If it's not a UUID, store it in details instead
        if (!details) {
          details = {};
        }
        details.originalEntityId = entityId;
      }
    }

    // Map to original audit_log schema requirements
    // table_name: Use entity_type or 'api_request' as fallback
    const tableName = entityType || 'api_request';
    
    // operation: Extract from action or default to 'SELECT' for GET requests
    let operation = 'SELECT'; // Default
    if (action.includes('POST') || action.includes('CREATE')) {
      operation = 'INSERT';
    } else if (action.includes('PUT') || action.includes('PATCH') || action.includes('UPDATE')) {
      operation = 'UPDATE';
    } else if (action.includes('DELETE')) {
      operation = 'DELETE';
    }

    await this.db.query(
      `INSERT INTO audit_log 
       (id, table_name, operation, record_id, user_id, chama_id, action, entity_type, entity_id, 
        ip_address, user_agent, device_fingerprint, session_id, 
        compliance_required, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)`,
      [
        logId,
        tableName.substring(0, 50), // Ensure it fits VARCHAR(50)
        operation,
        validEntityId, // record_id maps to entity_id
        context.userId || null,
        context.chamaId || null,
        action,
        entityType,
        validEntityId,
        context.ipAddress || null,
        context.userAgent || null,
        context.deviceFingerprint || null,
        context.sessionId || null,
        context.complianceRequired || false,
        details ? JSON.stringify(details) : null,
      ],
    );

    return logId;
  }

  /**
   * Log financial transaction
   */
  async logTransaction(
    transactionId: string,
    userId: string,
    chamaId: string | null,
    action: string,
    amount: number,
    context: AuditLogContext,
  ): Promise<string> {
    return this.logActivity(
      action,
      'transaction',
      transactionId,
      { ...context, userId, chamaId: chamaId || undefined },
      { amount, transactionId },
    );
  }

  /**
   * Log admin action
   */
  async logAdminAction(
    adminUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    context: AuditLogContext,
    details?: Record<string, any>,
  ): Promise<string> {
    return this.logActivity(
      action,
      targetType,
      targetId,
      { ...context, userId: adminUserId },
      { ...details, adminAction: true },
    );
  }

  /**
   * Log KYC action
   */
  async logKycAction(
    userId: string,
    action: string,
    documentType?: string,
    context?: AuditLogContext,
  ): Promise<string> {
    return this.logActivity(
      action,
      'kyc',
      userId,
      { ...context, userId },
      { documentType },
    );
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    userId: string,
    eventType: string,
    context: AuditLogContext,
    details?: Record<string, any>,
  ): Promise<string> {
    return this.logActivity(
      eventType,
      'security',
      userId,
      { ...context, userId },
      { ...details, securityEvent: true },
    );
  }

  /**
   * Log GDPR action
   */
  async logGdprAction(
    userId: string,
    action: string,
    requestId: string,
    context: AuditLogContext,
    details?: Record<string, any>,
  ): Promise<string> {
    return this.logActivity(
      action,
      'gdpr',
      requestId,
      { ...context, userId },
      { ...details, gdprAction: true },
    );
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters: {
    userId?: string;
    chamaId?: string;
    entityType?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    complianceRequired?: boolean;
    limit?: number;
  }): Promise<any[]> {
    let query = `SELECT * FROM audit_log WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.chamaId) {
      query += ` AND chama_id = $${paramIndex}`;
      params.push(filters.chamaId);
      paramIndex++;
    }

    if (filters.entityType) {
      query += ` AND entity_type = $${paramIndex}`;
      params.push(filters.entityType);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.complianceRequired !== undefined) {
      query += ` AND compliance_required = $${paramIndex}`;
      params.push(filters.complianceRequired);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(filters.limit || 100);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get compliance audit trail (for regulatory reporting)
   */
  async getComplianceAuditTrail(
    startDate: Date,
    endDate: Date,
    entityType?: string,
  ): Promise<any[]> {
    return this.getAuditLogs({
      startDate,
      endDate,
      entityType,
      complianceRequired: true,
      limit: 10000, // Large limit for compliance reports
    });
  }
}

