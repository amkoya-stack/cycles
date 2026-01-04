import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FileUploadService } from '../dispute/file-upload.service';
import * as crypto from 'crypto';

export interface KycDocumentUpload {
  documentType: 'id_front' | 'id_back' | 'selfie' | 'address_proof';
  file: Express.Multer.File;
}

export interface BiometricRegistration {
  biometricType: 'fingerprint' | 'face_id' | 'voice';
  templateHash: string; // Hash of biometric template (never store raw)
  deviceId: string;
}

export interface AddressVerification {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  postalCode?: string;
  country?: string;
  verificationMethod?: 'document' | 'geolocation' | 'manual';
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly fileUpload: FileUploadService,
  ) {}

  /**
   * Upload KYC document (ID front/back, selfie, address proof)
   */
  async uploadDocument(
    userId: string,
    upload: KycDocumentUpload,
  ): Promise<{ documentId: string; status: string }> {
    const { documentType, file } = upload;

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and PDF are allowed.',
      );
    }

    // Validate file size (max 5MB for images, 10MB for PDFs)
    const maxSize = file.mimetype === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size (${maxSize / 1024 / 1024}MB)`,
      );
    }

    // Calculate file hash for integrity verification
    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Upload file
    const uploadResult = await this.fileUpload.uploadFile(
      file,
      `kyc/${userId}`,
      allowedTypes,
      maxSize,
    );

    // Check if document of this type already exists
    const existing = await this.db.query(
      `SELECT id FROM kyc_documents 
       WHERE user_id = $1 AND document_type = $2 AND verification_status != 'expired'`,
      [userId, documentType],
    );

    let documentId: string;

    if (existing.rows.length > 0) {
      // Update existing document
      const result = await this.db.query(
        `UPDATE kyc_documents 
         SET file_url = $1, file_hash = $2, mime_type = $3, file_size = $4,
             verification_status = 'pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id`,
        [
          uploadResult.url,
          fileHash,
          file.mimetype,
          file.size,
          existing.rows[0].id,
        ],
      );
      documentId = result.rows[0].id;
    } else {
      // Create new document record
      const result = await this.db.query(
        `INSERT INTO kyc_documents 
         (user_id, document_type, file_url, file_hash, mime_type, file_size, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [userId, documentType, uploadResult.url, fileHash, file.mimetype, file.size],
      );
      documentId = result.rows[0].id;
    }

    // Update user KYC status to 'submitted' if all required documents are uploaded
    await this.checkKycCompletion(userId);

    return { documentId, status: 'pending' };
  }

  /**
   * Register biometric authentication
   */
  async registerBiometric(
    userId: string,
    biometric: BiometricRegistration,
  ): Promise<{ biometricId: string; success: boolean }> {
    const { biometricType, templateHash, deviceId } = biometric;

    // Validate template hash format (should be SHA-256 hash)
    if (!/^[a-f0-9]{64}$/i.test(templateHash)) {
      throw new BadRequestException('Invalid biometric template hash format');
    }

    // Check if biometric already exists for this user and type
    const existing = await this.db.query(
      `SELECT id FROM biometric_data 
       WHERE user_id = $1 AND biometric_type = $2 AND is_active = TRUE`,
      [userId, biometricType],
    );

    let biometricId: string;

    if (existing.rows.length > 0) {
      // Update existing biometric
      const result = await this.db.query(
        `UPDATE biometric_data 
         SET template_hash = $1, device_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id`,
        [templateHash, deviceId, existing.rows[0].id],
      );
      biometricId = result.rows[0].id;
    } else {
      // Create new biometric record
      const result = await this.db.query(
        `INSERT INTO biometric_data 
         (user_id, biometric_type, template_hash, device_id, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id`,
        [userId, biometricType, templateHash, deviceId],
      );
      biometricId = result.rows[0].id;
    }

    // Update user biometric_enabled flag
    await this.db.query(
      `UPDATE users SET biometric_enabled = TRUE WHERE id = $1`,
      [userId],
    );

    return { biometricId, success: true };
  }

  /**
   * Verify biometric authentication
   */
  async verifyBiometric(
    userId: string,
    biometricType: 'fingerprint' | 'face_id' | 'voice',
    templateHash: string,
    deviceId: string,
  ): Promise<{ verified: boolean; matchScore?: number }> {
    // Get user's registered biometric
    const result = await this.db.query(
      `SELECT template_hash FROM biometric_data 
       WHERE user_id = $1 AND biometric_type = $2 AND is_active = TRUE`,
      [userId, biometricType],
    );

    if (result.rows.length === 0) {
      return { verified: false };
    }

    const registeredHash = result.rows[0].template_hash;

    // In a real implementation, you would use a biometric matching algorithm
    // For now, we'll do exact hash match (in production, use fuzzy matching)
    const verified = registeredHash === templateHash;

    if (verified) {
      // Update last_used_at
      await this.db.query(
        `UPDATE biometric_data 
         SET last_used_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND biometric_type = $2`,
        [userId, biometricType],
      );
    }

    return { verified, matchScore: verified ? 100 : 0 };
  }

  /**
   * Submit address for verification
   */
  async submitAddress(
    userId: string,
    address: AddressVerification,
  ): Promise<{ verificationId: string; status: string }> {
    // Check if address already exists
    const existing = await this.db.query(
      `SELECT id FROM address_verifications 
       WHERE user_id = $1 AND verification_status != 'rejected'`,
      [userId],
    );

    let verificationId: string;

    if (existing.rows.length > 0) {
      // Update existing address
      const result = await this.db.query(
        `UPDATE address_verifications 
         SET address_line1 = $1, address_line2 = $2, city = $3, county = $4,
             postal_code = $5, country = $6, verification_status = 'pending',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING id`,
        [
          address.addressLine1,
          address.addressLine2 || null,
          address.city,
          address.county || null,
          address.postalCode || null,
          address.country || 'Kenya',
          existing.rows[0].id,
        ],
      );
      verificationId = result.rows[0].id;
    } else {
      // Create new address verification
      const result = await this.db.query(
        `INSERT INTO address_verifications 
         (user_id, address_line1, address_line2, city, county, postal_code, country, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING id`,
        [
          userId,
          address.addressLine1,
          address.addressLine2 || null,
          address.city,
          address.county || null,
          address.postalCode || null,
          address.country || 'Kenya',
        ],
      );
      verificationId = result.rows[0].id;
    }

    return { verificationId, status: 'pending' };
  }

  /**
   * Get KYC status for user
   */
  async getKycStatus(userId: string): Promise<any> {
    const userResult = await this.db.query(
      `SELECT kyc_status, kyc_level, kyc_submitted_at, kyc_verified_at, 
              kyc_expires_at, biometric_enabled, address_verified
       FROM users WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult.rows[0];

    // Get uploaded documents
    const documentsResult = await this.db.query(
      `SELECT document_type, verification_status, created_at, verified_at
       FROM kyc_documents 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    // Get biometric registrations
    const biometricsResult = await this.db.query(
      `SELECT biometric_type, is_active, last_used_at
       FROM biometric_data 
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    // Get address verification
    const addressResult = await this.db.query(
      `SELECT verification_status, city, county, country, verified_at
       FROM address_verifications 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    return {
      kycStatus: user.kyc_status,
      kycLevel: user.kyc_level,
      kycSubmittedAt: user.kyc_submitted_at,
      kycVerifiedAt: user.kyc_verified_at,
      kycExpiresAt: user.kyc_expires_at,
      biometricEnabled: user.biometric_enabled,
      addressVerified: user.address_verified,
      documents: documentsResult.rows,
      biometrics: biometricsResult.rows,
      address: addressResult.rows[0] || null,
    };
  }

  /**
   * Check if all required KYC documents are uploaded
   */
  private async checkKycCompletion(userId: string): Promise<void> {
    const requiredDocs = ['id_front', 'id_back', 'selfie'];
    const uploadedDocs = await this.db.query(
      `SELECT DISTINCT document_type FROM kyc_documents 
       WHERE user_id = $1 AND verification_status != 'expired'`,
      [userId],
    );

    const uploadedTypes = uploadedDocs.rows.map((r) => r.document_type);
    const allUploaded = requiredDocs.every((doc) => uploadedTypes.includes(doc));

    if (allUploaded) {
      // Update user KYC status to 'submitted'
      await this.db.query(
        `UPDATE users 
         SET kyc_status = 'submitted', kyc_submitted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND kyc_status = 'pending'`,
        [userId],
      );
    }
  }
}

