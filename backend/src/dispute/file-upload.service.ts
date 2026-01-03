/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly useS3: boolean;
  private readonly s3Bucket?: string;
  private readonly s3Region?: string;

  constructor(private readonly configService: ConfigService) {
    // For now, use local file storage
    // In production, configure S3 credentials
    this.useS3 = this.configService.get<string>('USE_S3_UPLOAD') === 'true';
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
    this.baseUrl = this.configService.get<string>('UPLOAD_BASE_URL') || 'http://localhost:4000/uploads';
    this.s3Bucket = this.configService.get<string>('S3_BUCKET');
    this.s3Region = this.configService.get<string>('S3_REGION') || 'us-east-1';

    // Ensure upload directory exists
    if (!this.useS3) {
      this.ensureUploadDir();
    }
  }

  /**
   * Upload a file (evidence, document, etc.)
   * Supports both local storage and S3
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'disputes',
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
    maxSize: number = 10 * 1024 * 1024, // 10MB default
  ): Promise<UploadResult> {
    // Validate file type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Validate file size
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size ${file.size} bytes exceeds maximum ${maxSize} bytes`,
      );
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const fileKey = `${folder}/${fileName}`;

    try {
      if (this.useS3) {
        return await this.uploadToS3(file, fileKey);
      } else {
        return await this.uploadToLocal(file, fileKey);
      }
    } catch (error: any) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload file to local storage
   */
  private async uploadToLocal(file: Express.Multer.File, fileKey: string): Promise<UploadResult> {
    const fullPath = path.join(this.uploadDir, fileKey);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, file.buffer);

    const url = `${this.baseUrl}/${fileKey}`;

    this.logger.log(`File uploaded to local storage: ${fileKey}`);

    return {
      url,
      key: fileKey,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };
  }

  /**
   * Upload file to S3 (requires aws-sdk)
   */
  private async uploadToS3(file: Express.Multer.File, fileKey: string): Promise<UploadResult> {
    // Dynamic import to avoid requiring aws-sdk if not using S3
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let AWS: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      AWS = require('aws-sdk');
    } catch (error) {
      throw new BadRequestException('aws-sdk package is required for S3 uploads. Install it with: npm install aws-sdk');
    }
    
    const s3 = new AWS.S3({
      region: this.s3Region,
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
    });

    const params = {
      Bucket: this.s3Bucket!,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read' as const, // Or 'private' for signed URLs
    };

    const result = await s3.upload(params).promise();

    this.logger.log(`File uploaded to S3: ${fileKey}`);

    return {
      url: result.Location,
      key: fileKey,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(fileKey: string): Promise<void> {
    try {
      if (this.useS3) {
        await this.deleteFromS3(fileKey);
      } else {
        await this.deleteFromLocal(fileKey);
      }
    } catch (error: any) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete file from local storage
   */
  private async deleteFromLocal(fileKey: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, fileKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.logger.log(`File deleted from local storage: ${fileKey}`);
    }
  }

  /**
   * Delete file from S3
   */
  private async deleteFromS3(fileKey: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let AWS: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      AWS = require('aws-sdk');
    } catch (error) {
      throw new BadRequestException('aws-sdk package is required for S3 operations. Install it with: npm install aws-sdk');
    }
    
    const s3 = new AWS.S3({
      region: this.s3Region,
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
    });

    await s3.deleteObject({
      Bucket: this.s3Bucket!,
      Key: fileKey,
    }).promise();

    this.logger.log(`File deleted from S3: ${fileKey}`);
  }

  /**
   * Get signed URL for private files (S3 only)
   */
  async getSignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    if (!this.useS3) {
      return `${this.baseUrl}/${fileKey}`;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let AWS: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      AWS = require('aws-sdk');
    } catch (error) {
      throw new BadRequestException('aws-sdk package is required for S3 operations. Install it with: npm install aws-sdk');
    }
    
    const s3 = new AWS.S3({
      region: this.s3Region,
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
    });

    return s3.getSignedUrlPromise('getObject', {
      Bucket: this.s3Bucket!,
      Key: fileKey,
      Expires: expiresIn,
    });
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }
}

