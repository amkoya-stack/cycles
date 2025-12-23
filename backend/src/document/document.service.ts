import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../cache/redis.service';
import {
  ActivityService,
  ActivityCategory,
  ActivityType,
} from '../activity/activity.service';
import {
  NotificationChannel,
  NotificationPriority,
} from '../activity/notification.service';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentDTO {
  name: string;
  description?: string;
  documentType: string;
  folderPath?: string;
  tags?: string[];
  file?: Express.Multer.File;
  fileUrl?: string;
}

export interface DocumentAccessDTO {
  userId?: string;
  role?: string;
  canView?: boolean;
  canDownload?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  expiresAt?: Date;
}

@Injectable()
export class DocumentService {
  constructor(
    private db: DatabaseService,
    private redis: RedisService,
    private activityService: ActivityService,
  ) {}

  /**
   * Upload a new document to the vault
   */
  async uploadDocument(
    chamaId: string,
    userId: string,
    dto: DocumentDTO,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      deviceInfo?: Record<string, any>;
    },
  ) {
    if (!dto.name || !dto.documentType) {
      throw new BadRequestException('Document name and type are required');
    }

    if (!dto.fileUrl && !dto.file) {
      throw new BadRequestException('File URL or file upload is required');
    }

    // Verify user has permission to upload documents in this chama
    const userRole = await this.getUserChamaRole(chamaId, userId);
    const canUpload = [
      'CHAIRPERSON',
      'VICE_CHAIR',
      'SECRETARY',
      'TREASURER',
    ].includes(userRole);

    if (!canUpload) {
      throw new ForbiddenException(
        'You do not have permission to upload documents',
      );
    }

    const documentId = uuidv4();
    const fileHash = this.generateHash(dto.file?.filename || dto.name);
    const mimeType = dto.file?.mimetype || 'application/octet-stream';

    const createdDoc = await this.db.transaction(async (client) => {
      // Insert document
      const doc = await client.query(
        `INSERT INTO documents (
          id, chama_id, created_by, name, description, document_type, 
          folder_path, tags, file_url, file_size, mime_type, file_hash, current_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          documentId,
          chamaId,
          userId,
          dto.name,
          dto.description || null,
          dto.documentType,
          dto.folderPath || null,
          dto.tags || [],
          dto.fileUrl,
          dto.file?.size || 0,
          mimeType,
          fileHash,
          1,
        ],
      );

      // Insert first version
      await client.query(
        `INSERT INTO document_versions (
          document_id, version_number, file_url, file_size, file_hash, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, 1, dto.fileUrl, dto.file?.size || 0, fileHash, userId],
      );

      // Log access
      await this.logAccess(chamaId, documentId, userId, 'UPLOAD', true);

      // Invalidate cache
      await this.redis.del(`chama_documents:${chamaId}`);

      return doc.rows[0];
    });

    await this.activityService.logActivityWithAuditAndNotify({
      activity: {
        chamaId,
        userId,
        category: ActivityCategory.DOCUMENT,
        activityType: ActivityType.DOCUMENT_UPLOADED,
        title: `Document uploaded: ${createdDoc.name}`,
        description: createdDoc.description || dto.description,
        metadata: {
          documentId,
          documentType: createdDoc.document_type,
          folderPath: createdDoc.folder_path,
          tags: createdDoc.tags,
          version: 1,
          mimeType: createdDoc.mime_type,
          size: createdDoc.file_size,
        },
        entityType: 'document',
        entityId: documentId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        deviceInfo: context?.deviceInfo,
      },
      notify: {
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.MEDIUM,
        message: `${createdDoc.name} was uploaded`,
        excludeUserId: userId,
      },
    });

    return createdDoc;
  }

  /**
   * Upload a new version of an existing document
   */
  async uploadVersion(
    chamaId: string,
    documentId: string,
    userId: string,
    file: Express.Multer.File,
    changeDescription?: string,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      deviceInfo?: Record<string, any>;
    },
  ) {
    // Verify document ownership/access
    const doc = await this.getDocumentById(chamaId, documentId);

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    // Check edit permission
    const hasPermission = await this.checkPermission(
      documentId,
      userId,
      'can_edit',
    );
    if (!hasPermission && doc.created_by !== userId) {
      throw new ForbiddenException(
        'You do not have permission to edit this document',
      );
    }

    const fileHash = this.generateHash(file.filename);
    const newVersion = doc.current_version + 1;

    const updatedDoc = await this.db.transaction(async (client) => {
      // Insert new version
      await client.query(
        `INSERT INTO document_versions (
          document_id, version_number, file_url, file_size, file_hash, uploaded_by, change_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          documentId,
          newVersion,
          file.filename, // In production, upload to S3/R2 and store URL
          file.size,
          fileHash,
          userId,
          changeDescription || null,
        ],
      );

      // Update document
      const updated = await client.query(
        `UPDATE documents 
         SET current_version = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [newVersion, documentId],
      );

      // Log access
      await this.logAccess(chamaId, documentId, userId, 'UPLOAD', true);

      // Invalidate cache
      await this.redis.del(`chama_documents:${chamaId}`);
      await this.redis.del(`document:${documentId}`);

      return updated.rows[0];
    });

    await this.activityService.logActivityWithAuditAndNotify({
      activity: {
        chamaId,
        userId,
        category: ActivityCategory.DOCUMENT,
        activityType: ActivityType.DOCUMENT_UPLOADED,
        title: `New version uploaded: ${updatedDoc.name} (v${updatedDoc.current_version})`,
        description: changeDescription || updatedDoc.description,
        metadata: {
          documentId,
          version: updatedDoc.current_version,
          mimeType: updatedDoc.mime_type,
          size: updatedDoc.file_size,
          changeDescription,
        },
        entityType: 'document',
        entityId: documentId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        deviceInfo: context?.deviceInfo,
      },
      notify: {
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.MEDIUM,
        message: `${updatedDoc.name} updated to v${updatedDoc.current_version}`,
        excludeUserId: userId,
      },
    });

    return updatedDoc;
  }

  /**
   * Get document by ID with permission check
   */
  async getDocumentById(chamaId: string, documentId: string, userId?: string) {
    const cached = await this.redis.get(`document:${documentId}`);
    if (cached) return JSON.parse(cached);

    const result = await this.db.query(
      `SELECT d.*, u.full_name as creator_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = $1 AND d.chama_id = $2 AND d.deleted_at IS NULL`,
      [documentId, chamaId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Document not found');
    }

    const doc = result.rows[0];

    if (userId) {
      await this.logAccess(chamaId, documentId, userId, 'VIEW', true);
    }

    // Cache for 1 hour
    await this.redis.set(`document:${documentId}`, JSON.stringify(doc), 3600);

    return doc;
  }

  /**
   * List documents in chama with filtering
   */
  async listDocuments(
    chamaId: string,
    userId: string,
    filters?: {
      type?: string;
      folder?: string;
      tags?: string[];
      search?: string;
      uploadedBy?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const cacheKey = `chama_documents:${chamaId}:${JSON.stringify(filters || {})}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let query = `
      SELECT d.*, u.full_name as creator_name, 
             COUNT(dv.id) as version_count,
             (SELECT COUNT(*) FROM document_access_logs WHERE document_id = d.id) as access_count
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN document_versions dv ON d.id = dv.document_id
      WHERE d.chama_id = $1 AND d.deleted_at IS NULL
    `;

    const params: any[] = [chamaId];
    let paramIndex = 2;

    if (filters?.type) {
      query += ` AND d.document_type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.folder) {
      query += ` AND d.folder_path LIKE $${paramIndex}`;
      params.push(`${filters.folder}%`);
      paramIndex++;
    }

    if (filters?.tags && filters.tags.length > 0) {
      query += ` AND d.tags && $${paramIndex}`;
      params.push(filters.tags);
      paramIndex++;
    }

    if (filters?.uploadedBy) {
      query += ` AND d.created_by = $${paramIndex}`;
      params.push(filters.uploadedBy);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND d.created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND d.created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters?.search) {
      query += `
        AND d.id IN (
          SELECT document_id FROM document_search_index
          WHERE name_tsvector @@ plainto_tsquery('english', $${paramIndex})
             OR description_tsvector @@ plainto_tsquery('english', $${paramIndex})
             OR tags_tsvector @@ plainto_tsquery('english', $${paramIndex})
        )
      `;
      params.push(filters.search);
      paramIndex++;
    }

    query += ` GROUP BY d.id, u.id ORDER BY d.created_at DESC`;

    const result = await this.db.query(query, params);

    // Filter by user's permissions
    const documents = result.rows.filter(async (doc) => {
      const hasAccess = await this.checkPermission(doc.id, userId, 'can_view');
      return hasAccess || doc.created_by === userId;
    });

    // Cache for 30 minutes
    await this.redis.set(cacheKey, JSON.stringify(documents), 1800);

    return documents;
  }

  /**
   * Get document version history
   */
  async getVersionHistory(chamaId: string, documentId: string) {
    const cacheKey = `document_versions:${documentId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.db.query(
      `SELECT dv.*, u.full_name as uploaded_by_name
       FROM document_versions dv
       LEFT JOIN users u ON dv.uploaded_by = u.id
       WHERE dv.document_id = $1
       ORDER BY dv.version_number DESC`,
      [documentId],
    );

    await this.redis.set(cacheKey, JSON.stringify(result.rows), 3600);
    return result.rows;
  }

  /**
   * Delete document (soft delete)
   */
  async deleteDocument(
    chamaId: string,
    documentId: string,
    userId: string,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      deviceInfo?: Record<string, any>;
    },
  ) {
    const doc = await this.getDocumentById(chamaId, documentId);

    if (doc.created_by !== userId) {
      throw new ForbiddenException('Only document creator can delete');
    }

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [documentId],
      );

      await this.logAccess(chamaId, documentId, userId, 'DELETE', true);
    });

    // Invalidate caches
    await this.redis.del(`document:${documentId}`);
    await this.redis.del(`chama_documents:${chamaId}`);

    await this.activityService.logActivityWithAuditAndNotify({
      activity: {
        chamaId,
        userId,
        category: ActivityCategory.DOCUMENT,
        activityType: ActivityType.DOCUMENT_DELETED,
        title: `Document deleted: ${doc.name}`,
        description: doc.description,
        metadata: {
          documentId,
          documentType: doc.document_type,
          folderPath: doc.folder_path,
          tags: doc.tags,
        },
        entityType: 'document',
        entityId: documentId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        deviceInfo: context?.deviceInfo,
      },
      notify: {
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.HIGH,
        message: `${doc.name} was deleted`,
        excludeUserId: userId,
      },
    });
  }

  /**
   * Grant access to document
   */
  async grantAccess(
    chamaId: string,
    documentId: string,
    grantedBy: string,
    dto: DocumentAccessDTO,
  ) {
    // Verify granter has permission
    const doc = await this.getDocumentById(chamaId, documentId);
    if (doc.created_by !== grantedBy) {
      throw new ForbiddenException('Only document creator can grant access');
    }

    const accessId = uuidv4();

    await this.db.query(
      `INSERT INTO document_access (
        id, document_id, user_id, role, can_view, can_download, can_edit, can_delete, can_share, granted_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (document_id, user_id) DO UPDATE SET
        can_view = $5, can_download = $6, can_edit = $7, can_delete = $8, can_share = $9
      RETURNING *`,
      [
        accessId,
        documentId,
        dto.userId || null,
        dto.role || null,
        dto.canView ?? true,
        dto.canDownload ?? false,
        dto.canEdit ?? false,
        dto.canDelete ?? false,
        dto.canShare ?? false,
        grantedBy,
        dto.expiresAt || null,
      ],
    );

    // Invalidate caches
    await this.redis.del(`document_access:${documentId}`);
  }

  /**
   * Check if user has permission for document
   */
  async checkPermission(
    documentId: string,
    userId: string,
    permission:
      | 'can_view'
      | 'can_download'
      | 'can_edit'
      | 'can_delete'
      | 'can_share',
  ): Promise<boolean> {
    const result = await this.db.query(
      `SELECT ${permission} FROM document_access 
       WHERE document_id = $1 AND user_id = $2 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [documentId, userId],
    );

    return result.rowCount > 0 && result.rows[0][permission];
  }

  /**
   * Get access logs for document
   */
  async getAccessLogs(chamaId: string, documentId: string, userId: string) {
    // Verify user can access logs
    const doc = await this.getDocumentById(chamaId, documentId);
    if (doc.created_by !== userId) {
      throw new ForbiddenException(
        'Only document creator can view access logs',
      );
    }

    return await this.db.query(
      `SELECT dal.*, u.full_name as user_name
       FROM document_access_logs dal
       LEFT JOIN users u ON dal.user_id = u.id
       WHERE dal.document_id = $1
       ORDER BY dal.created_at DESC
       LIMIT 100`,
      [documentId],
    );
  }

  /**
   * Helper: Log document access
   */
  private async logAccess(
    chamaId: string,
    documentId: string,
    userId: string,
    action: string,
    success: boolean,
    errorMessage?: string,
  ) {
    try {
      await this.db.query(
        `INSERT INTO document_access_logs (document_id, user_id, action, success, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, userId, action, success, errorMessage || null],
      );
    } catch (error) {
      // Log errors silently to not interrupt main flow
      console.error('Failed to log document access:', error);
    }
  }

  /**
   * Helper: Get user's role in chama
   */
  private async getUserChamaRole(
    chamaId: string,
    userId: string,
  ): Promise<string> {
    const result = await this.db.query(
      `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    return result.rowCount > 0 ? result.rows[0].role : 'MEMBER';
  }

  /**
   * Helper: Generate file hash
   */
  private generateHash(filename: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(filename + Date.now())
      .digest('hex');
  }
}
