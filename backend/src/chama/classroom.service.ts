/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FileUploadService } from '../dispute/file-upload.service';
import { v4 as uuidv4 } from 'uuid';

export interface CourseDTO {
  title: string;
  description?: string;
  fileType: 'pdf' | 'audio' | 'video';
  file?: Express.Multer.File;
  thumbnail?: Express.Multer.File;
  lockType?: 'none' | 'reputation' | 'price' | 'both';
  requiredReputationTier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  unlockPrice?: number;
}

@Injectable()
export class ClassroomService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Get all courses for a chama
   */
  async getCourses(chamaId: string, userId: string) {
    await this.db.setUserContext(userId);

    try {
      // Verify membership
      await this.verifyMembership(chamaId, userId);

      // Get user's reputation tier
      const reputationResult = await this.db.query(
        `SELECT tier FROM reputation_scores WHERE user_id = $1 AND chama_id = $2`,
        [userId, chamaId],
      );
      const userTier = reputationResult.rows[0]?.tier || 'bronze';

      // Get user's course unlocks
      const unlocksResult = await this.db.query(
        `SELECT course_id FROM course_unlocks WHERE user_id = $1`,
        [userId],
      );
      const unlockedCourseIds = new Set(unlocksResult.rows.map(r => r.course_id));

      const result = await this.db.query(
        `SELECT 
          c.id,
          c.title,
          c.description,
          c.file_type,
          c.file_name,
          c.file_url,
          c.file_size,
          c.mime_type,
          c.thumbnail_url,
          c.uploaded_by,
          c.lock_type,
          c.required_reputation_tier,
          c.unlock_price,
          u.full_name as uploaded_by_name,
          c.created_at as uploaded_at
        FROM classroom_courses c
        LEFT JOIN users u ON c.uploaded_by = u.id
        WHERE c.chama_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC`,
        [chamaId],
      );

      // Tier hierarchy for comparison
      const tierHierarchy = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
      const userTierLevel = tierHierarchy[userTier as keyof typeof tierHierarchy] || 1;

      const courses = result.rows.map((row) => {
        const isUnlocked = unlockedCourseIds.has(row.id);
        let isLocked = false;
        let lockReason: string | null = null;

        if (row.lock_type && row.lock_type !== 'none' && !isUnlocked) {
          const requiredTierLevel = row.required_reputation_tier 
            ? tierHierarchy[row.required_reputation_tier as keyof typeof tierHierarchy] || 0 
            : 0;
          const userMeetsReputation = requiredTierLevel > 0 && userTierLevel >= requiredTierLevel;

          if (row.lock_type === 'reputation') {
            if (userTierLevel < requiredTierLevel) {
              isLocked = true;
              lockReason = `Unlock at ${row.required_reputation_tier.charAt(0).toUpperCase() + row.required_reputation_tier.slice(1)}`;
            }
          } else if (row.lock_type === 'price') {
            if (row.unlock_price) {
              isLocked = true;
              lockReason = `Unlock for Kes ${row.unlock_price}`;
            }
          } else if (row.lock_type === 'both') {
            // Locked by both - user can unlock via reputation OR purchase
            // If user meets reputation requirement, they can access (not locked)
            if (!isUnlocked && !userMeetsReputation && row.unlock_price) {
              // User doesn't meet reputation AND hasn't purchased - locked with both options
              isLocked = true;
              lockReason = `Unlock at ${row.required_reputation_tier.charAt(0).toUpperCase() + row.required_reputation_tier.slice(1)} or Kes ${row.unlock_price}`;
            } else if (!isUnlocked && !userMeetsReputation) {
              // Only reputation requirement (no price set)
              isLocked = true;
              lockReason = `Unlock at ${row.required_reputation_tier.charAt(0).toUpperCase() + row.required_reputation_tier.slice(1)}`;
            }
            // If userMeetsReputation, course is accessible (not locked) even without explicit unlock record
          }
        }

        return {
          id: row.id,
          title: row.title,
          description: row.description,
          fileType: row.file_type,
          fileName: row.file_name,
          fileUrl: row.file_url,
          fileSize: parseInt(row.file_size, 10),
          thumbnailUrl: row.thumbnail_url || null,
          uploadedBy: row.uploaded_by_name || 'Unknown',
          uploadedAt: row.uploaded_at,
          isLocked,
          lockReason,
          lockType: row.lock_type || 'none',
          requiredReputationTier: row.required_reputation_tier,
          unlockPrice: row.unlock_price ? parseFloat(row.unlock_price) : null,
        };
      });

      return { courses };
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Upload a new course
   */
  async uploadCourse(
    chamaId: string,
    userId: string,
    dto: CourseDTO,
  ) {
    await this.db.setUserContext(userId);

    try {
      // Verify membership (all active members can upload)
      await this.verifyMembership(chamaId, userId);

      if (!dto.title || !dto.fileType) {
        throw new BadRequestException('Title and file type are required');
      }

      if (!dto.file) {
        throw new BadRequestException('File is required');
      }

      // Validate file type matches (check both MIME type and extension)
      const allowedMimeTypes: Record<string, string[]> = {
        pdf: ['application/pdf', 'application/x-pdf'],
        audio: [
          'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 
          'audio/webm', 'audio/wma', 'audio/x-ms-wma', 'audio/flac', 
          'audio/x-flac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 
          'audio/x-mpeg', 'audio/opus', 'audio/amr', 'audio/x-amr',
          'audio/3gp', 'audio/x-3gp', 'audio/aiff', 'audio/x-aiff',
          'audio/basic', 'audio/x-aiff', 'audio/x-pn-realaudio'
        ],
        video: [
          'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 
          'video/x-msvideo', 'video/x-ms-wmv', 'video/x-matroska',
          'video/x-matroska-3d', 'video/x-flv', 'video/x-f4v',
          'video/3gpp', 'video/x-3gpp', 'video/3gp', 'video/mpeg',
          'video/x-mpeg', 'video/x-mpeg2', 'video/x-m4v', 'video/x-m2v',
          'video/avi', 'video/x-ms-asf', 'video/x-ms-wvx',
          'video/vnd.rn-realvideo', 'video/realvideo'
        ],
      };

      const allowedExtensions: Record<string, string[]> = {
        pdf: ['pdf'],
        audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'wma', 'm4a', 'opus', 'amr', '3gp', 'aiff', 'aif', 'au', 'ra'],
        video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'mpg', 'mpeg', 'm2v', 'f4v', 'asf', 'rm', 'rmvb', 'vob', 'ogv', 'ts', 'mts', 'm2ts'],
      };

      // Check MIME type first
      const allowedMimeTypesList = allowedMimeTypes[dto.fileType] || [];
      const fileMimeType = dto.file.mimetype.toLowerCase();
      // Check for exact match
      let isValidMimeType = allowedMimeTypesList.some(allowed => 
        fileMimeType === allowed.toLowerCase()
      );

      // If MIME type check fails, check file extension as fallback
      if (!isValidMimeType) {
        const fileName = dto.file.originalname.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
        const allowedExtensionsList = allowedExtensions[dto.fileType] || [];
        const isValidExtension = allowedExtensionsList.includes(fileExtension);

        if (!isValidExtension) {
          throw new BadRequestException(
            `File type ${dto.file.mimetype} (extension: .${fileExtension}) does not match course type ${dto.fileType}. Allowed: ${allowedMimeTypesList.join(', ')} or extensions: .${allowedExtensionsList.join(', .')}`,
          );
        }
      }

      // Validate file size (350MB max)
      const maxSize = 350 * 1024 * 1024; // 350MB
      if (dto.file.size > maxSize) {
        throw new BadRequestException(
          `File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`,
        );
      }

      // Upload main course file (pass all allowed MIME types for the file type category)
      // Skip MIME validation since we've already validated with extension fallback
      const uploadResult = await this.fileUploadService.uploadFile(
        dto.file,
        `classroom/${chamaId}`,
        allowedMimeTypesList, // Pass all allowed MIME types for this category
        maxSize,
        true, // Skip MIME validation - we've already validated with extension fallback
      );

      // Upload thumbnail if provided (optional)
      let thumbnailUrl: string | null = null;
      if (dto.thumbnail) {
        // Validate thumbnail is an image - accept any image MIME type
        const thumbnailMimeType = dto.thumbnail.mimetype.toLowerCase();
        const imageMimeTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon',
          'image/vnd.microsoft.icon', 'image/x-png', 'image/pjpeg'
        ];
        
        // Check if it's an image type (more lenient - accept any image/*)
        const isImageType = thumbnailMimeType.startsWith('image/') || 
                           imageMimeTypes.includes(thumbnailMimeType);
        
        if (!isImageType) {
          // Also check file extension as fallback
          const fileName = dto.thumbnail.originalname.toLowerCase();
          const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'];
          
          if (!imageExtensions.includes(fileExtension)) {
            throw new BadRequestException(
              'Thumbnail must be an image file (JPEG, PNG, GIF, WebP, BMP, SVG, ICO, or TIFF)',
            );
          }
        }

        // Validate thumbnail size (5MB max)
        const thumbnailMaxSize = 5 * 1024 * 1024; // 5MB
        if (dto.thumbnail.size > thumbnailMaxSize) {
          throw new BadRequestException(
            `Thumbnail size exceeds maximum of ${thumbnailMaxSize / (1024 * 1024)}MB`,
          );
        }

        // Use broader image MIME types list for upload service
        const allImageMimeTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon',
          'image/vnd.microsoft.icon', 'image/x-png', 'image/pjpeg'
        ];

        const thumbnailUploadResult = await this.fileUploadService.uploadFile(
          dto.thumbnail,
          `classroom/${chamaId}/thumbnails`,
          allImageMimeTypes,
          thumbnailMaxSize,
          true, // Skip strict MIME validation - we've already validated
        );

        thumbnailUrl = thumbnailUploadResult.url;
        console.log('[ClassroomService] Thumbnail uploaded:', {
          originalName: dto.thumbnail.originalname,
          mimetype: dto.thumbnail.mimetype,
          size: dto.thumbnail.size,
          url: thumbnailUrl,
        });
      }

      const courseId = uuidv4();

      // Validate lock settings
      const lockType = dto.lockType || 'none';
      if (lockType !== 'none') {
        if (lockType === 'reputation' || lockType === 'both') {
          if (!dto.requiredReputationTier) {
            throw new BadRequestException('Required reputation tier must be specified when locking by reputation');
          }
          const validTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
          if (!validTiers.includes(dto.requiredReputationTier)) {
            throw new BadRequestException(`Invalid reputation tier. Must be one of: ${validTiers.join(', ')}`);
          }
        }
        if (lockType === 'price' || lockType === 'both') {
          if (!dto.unlockPrice || dto.unlockPrice < 5) {
            throw new BadRequestException('Unlock price must be at least Kes 5');
          }
        }
      }

      // Insert course into database
      const result = await this.db.query(
        `INSERT INTO classroom_courses (
          id, chama_id, uploaded_by, title, description, file_type,
          file_name, file_url, file_size, mime_type, thumbnail_url,
          lock_type, required_reputation_tier, unlock_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          courseId,
          chamaId,
          userId,
          dto.title,
          dto.description || null,
          dto.fileType,
          dto.file.originalname,
          uploadResult.url,
          dto.file.size,
          dto.file.mimetype,
          thumbnailUrl,
          lockType,
          dto.requiredReputationTier || null,
          dto.unlockPrice || null,
        ],
      );

      const course = result.rows[0];

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        fileType: course.file_type,
        fileName: course.file_name,
        fileUrl: course.file_url,
        fileSize: parseInt(course.file_size, 10),
        thumbnailUrl: course.thumbnail_url || null,
        uploadedBy: userId,
        uploadedAt: course.created_at,
        lockType: course.lock_type || 'none',
        requiredReputationTier: course.required_reputation_tier,
        unlockPrice: course.unlock_price ? parseFloat(course.unlock_price) : null,
      };
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Unlock a course (via reputation or purchase)
   */
  async unlockCourse(
    chamaId: string,
    courseId: string,
    userId: string,
    unlockMethod: 'reputation' | 'purchase',
  ) {
    await this.db.setUserContext(userId);

    try {
      // Verify membership
      await this.verifyMembership(chamaId, userId);

      // Get course
      const courseResult = await this.db.query(
        `SELECT * FROM classroom_courses 
         WHERE id = $1 AND chama_id = $2 AND deleted_at IS NULL`,
        [courseId, chamaId],
      );

      if (courseResult.rows.length === 0) {
        throw new NotFoundException('Course not found');
      }

      const course = courseResult.rows[0];

      // Check if already unlocked
      const existingUnlock = await this.db.query(
        `SELECT * FROM course_unlocks WHERE course_id = $1 AND user_id = $2`,
        [courseId, userId],
      );

      if (existingUnlock.rows.length > 0) {
        return { success: true, message: 'Course already unlocked' };
      }

      // Validate unlock method
      if (unlockMethod === 'reputation') {
        if (course.lock_type !== 'reputation' && course.lock_type !== 'both') {
          throw new BadRequestException('Course is not locked by reputation');
        }

        // Get user's reputation tier
        const reputationResult = await this.db.query(
          `SELECT tier, total_score FROM reputation_scores 
           WHERE user_id = $1 AND chama_id = $2`,
          [userId, chamaId],
        );

        if (reputationResult.rows.length === 0) {
          throw new ForbiddenException('You do not have a reputation score in this chama');
        }

        const userTier = reputationResult.rows[0].tier || 'bronze';
        const userTierLevel = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 }[userTier] || 1;
        const requiredTierLevel = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 }[course.required_reputation_tier] || 0;

        if (userTierLevel < requiredTierLevel) {
          throw new ForbiddenException(
            `You need ${course.required_reputation_tier} tier to unlock this course. Your current tier is ${userTier}.`,
          );
        }

        // Create unlock record
        await this.db.query(
          `INSERT INTO course_unlocks (
            course_id, user_id, unlock_method, reputation_tier, reputation_score
          ) VALUES ($1, $2, $3, $4, $5)`,
          [courseId, userId, 'reputation', userTier, reputationResult.rows[0].total_score],
        );

        return { success: true, message: 'Course unlocked via reputation' };
      } else if (unlockMethod === 'purchase') {
        if (course.lock_type !== 'price' && course.lock_type !== 'both') {
          throw new BadRequestException('Course is not available for purchase');
        }

        if (!course.unlock_price || course.unlock_price < 5) {
          throw new BadRequestException('Course does not have a valid unlock price');
        }

        // TODO: Integrate with payment system
        // For now, we'll create the unlock record directly
        // In production, this should:
        // 1. Create a payment transaction
        // 2. Process payment (M-Pesa, wallet, etc.)
        // 3. On successful payment, create unlock record

        // Create unlock record (payment processing would happen before this)
        await this.db.query(
          `INSERT INTO course_unlocks (
            course_id, user_id, unlock_method, amount_paid
          ) VALUES ($1, $2, $3, $4)`,
          [courseId, userId, 'purchase', course.unlock_price],
        );

        return { 
          success: true, 
          message: 'Course unlocked via purchase',
          amountPaid: parseFloat(course.unlock_price),
        };
      }

      throw new BadRequestException('Invalid unlock method');
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Delete a course (soft delete)
   */
  async deleteCourse(chamaId: string, courseId: string, userId: string) {
    await this.db.setUserContext(userId);

    try {
      // Verify membership and admin role
      const userRole = await this.verifyMembershipAndRole(chamaId, userId);

      if (!['admin', 'secretary', 'treasurer'].includes(userRole)) {
        throw new ForbiddenException('Only admins can delete courses');
      }

      // Check if course exists
      const courseResult = await this.db.query(
        `SELECT file_url FROM classroom_courses 
         WHERE id = $1 AND chama_id = $2 AND deleted_at IS NULL`,
        [courseId, chamaId],
      );

      if (courseResult.rowCount === 0) {
        throw new NotFoundException('Course not found');
      }

      const course = courseResult.rows[0];

      // Soft delete in database
      await this.db.query(
        `UPDATE classroom_courses 
         SET deleted_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND chama_id = $2`,
        [courseId, chamaId],
      );

      // Optionally delete the file from storage
      // Extract file key from URL (assuming format: baseUrl/folder/filename)
      try {
        const urlParts = course.file_url.split('/');
        const fileKey = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)
        await this.fileUploadService.deleteFile(fileKey);
      } catch (error) {
        // Log but don't fail if file deletion fails
        console.error('Failed to delete course file:', error);
      }

      return { success: true };
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Verify user is a member of the chama
   */
  private async verifyMembership(chamaId: string, userId: string): Promise<void> {
    const result = await this.db.query(
      `SELECT status FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    if (result.rowCount === 0 || result.rows[0].status !== 'active') {
      throw new ForbiddenException('You are not a member of this chama');
    }
  }

  /**
   * Verify membership and return user role
   */
  private async verifyMembershipAndRole(
    chamaId: string,
    userId: string,
  ): Promise<string> {
    const result = await this.db.query(
      `SELECT role, status FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    if (result.rowCount === 0 || result.rows[0].status !== 'active') {
      throw new ForbiddenException('You are not a member of this chama');
    }

    return result.rows[0].role;
  }
}

