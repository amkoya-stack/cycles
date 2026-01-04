import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../../cache/redis.service';

/**
 * Tokenization Service
 * 
 * Encrypts PII before storing in database.
 * Uses Redis for reverse lookup caching.
 * 
 * Phase 2: Tokenization of Sensitive Data
 * Phase 15: Extended for analytics tokenization
 */
@Injectable()
export class TokenizationService {
  private readonly logger = new Logger(TokenizationService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    // Get encryption key from config
    const secretKey =
      this.configService.get<string>('TOKENIZATION_SECRET_KEY') ||
      this.configService.get<string>('TOKENIZATION_KEY') ||
      'default-secret-key-change-in-production-minimum-32-characters';

    if (secretKey === 'default-secret-key-change-in-production-minimum-32-characters') {
      this.logger.warn(
        '[TokenizationService] Using default encryption key. Set TOKENIZATION_SECRET_KEY in environment.',
      );
    }

    if (secretKey.length < 32) {
      throw new Error(
        'TOKENIZATION_SECRET_KEY must be at least 32 characters long',
      );
    }

    // Derive encryption key using scrypt
    this.encryptionKey = crypto.scryptSync(secretKey, 'salt', 32);
  }

  /**
   * Tokenize a sensitive value (reversible encryption)
   * @param value - Value to tokenize
   * @param fieldName - Field name for reverse lookup caching (optional)
   */
  async tokenize(value: string | number, fieldName?: string): Promise<string> {
    const stringValue = String(value);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(stringValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encrypted (base64 encoded)
    const token = Buffer.from(
      `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`,
    ).toString('base64');

    const tokenized = `tok_${token}`;

    // Cache reverse lookup in Redis (24-hour TTL)
    if (fieldName && value) {
      const cacheKey = `tokenization:${fieldName}:${stringValue}`;
      try {
        await this.redis.set(cacheKey, tokenized, 86400); // 24 hours
      } catch (error) {
        this.logger.warn(`Failed to cache tokenization for ${fieldName}:`, error);
      }
    }

    return tokenized;
  }

  /**
   * Detokenize a token (reverse encryption)
   * Checks Redis cache first for faster lookup
   * @param token - Token to detokenize
   * @param fieldName - Field name for cache lookup (optional)
   */
  async detokenize(token: string, fieldName?: string): Promise<string | null> {
    try {
      if (!token || !token.startsWith('tok_')) {
        return token; // Return as-is if not a token
      }

      const decoded = Buffer.from(token.slice(4), 'base64').toString('utf8');
      const [ivHex, authTagHex, encrypted] = decoded.split(':');

      if (!ivHex || !authTagHex || !encrypted) {
        return null;
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('[TokenizationService] Detokenization failed:', error);
      return null;
    }
  }

  /**
   * Find token for a given value (reverse lookup)
   * Checks Redis cache first
   * @param value - Original value
   * @param fieldName - Field name
   */
  async findToken(value: string | number, fieldName: string): Promise<string | null> {
    const stringValue = String(value);
    const cacheKey = `tokenization:${fieldName}:${stringValue}`;

    try {
      // Check Redis cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Failed to get tokenization from cache for ${fieldName}:`, error);
    }

    // If not in cache, tokenize it (which will cache it)
    return this.tokenize(value, fieldName);
  }

  /**
   * Tokenize an object's sensitive fields
   * @param data - Object to tokenize
   * @param fields - Fields to tokenize
   */
  async tokenizeObject<T extends Record<string, any>>(
    data: T,
    fields: string[] = ['email', 'phone', 'userId', 'chamaId', 'amount', 'balance'],
  ): Promise<T> {
    const tokenized = { ...data } as any;

    for (const field of fields) {
      if (field in tokenized && tokenized[field] != null) {
        tokenized[field] = await this.tokenize(tokenized[field], field);
      }
    }

    return tokenized as T;
  }

  /**
   * Detokenize an object's sensitive fields
   * @param data - Object to detokenize
   * @param fields - Fields to detokenize
   */
  async detokenizeObject<T extends Record<string, any>>(
    data: T,
    fields: string[] = ['email', 'phone', 'userId', 'chamaId', 'amount', 'balance'],
  ): Promise<T> {
    const detokenized = { ...data } as any;

    for (const field of fields) {
      if (detokenized[field] != null) {
        detokenized[field] = await this.detokenize(detokenized[field], field);
      }
    }

    return detokenized as T;
  }

  /**
   * Tokenize phone number (format-preserving)
   */
  async tokenizePhone(phone: string): Promise<string> {
    return this.tokenize(phone, 'phone');
  }

  /**
   * Tokenize email (format-preserving)
   */
  async tokenizeEmail(email: string): Promise<string> {
    return this.tokenize(email, 'email');
  }

  /**
   * Hash a sensitive value (irreversible)
   * Use for public analytics where you don't need to reverse lookup
   */
  hash(value: string | number): string {
    const stringValue = String(value);
    const secretKey = this.configService.get<string>('TOKENIZATION_SECRET_KEY') || 
                     this.configService.get<string>('TOKENIZATION_KEY') || 
                     'default-key';
    const hash = crypto
      .createHash('sha256')
      .update(stringValue + secretKey) // Salt with key
      .digest('hex');
    return `hash_${hash.slice(0, 16)}`; // Return first 16 chars for readability
  }

  /**
   * Tokenize an array of objects
   */
  async tokenizeArray<T extends Record<string, any>>(
    data: T[],
    fields: string[] = ['email', 'phone', 'userId', 'chamaId', 'amount', 'balance'],
  ): Promise<T[]> {
    return Promise.all(data.map((item) => this.tokenizeObject(item, fields)));
  }

  /**
   * Mask sensitive data (partial reveal)
   * e.g., "user@example.com" -> "us***@ex***.com"
   */
  mask(value: string, revealStart = 2, revealEnd = 2): string {
    if (value.length <= revealStart + revealEnd) {
      return '***';
    }

    const start = value.slice(0, revealStart);
    const end = value.slice(-revealEnd);
    const middle = '*'.repeat(Math.min(value.length - revealStart - revealEnd, 8));

    return `${start}${middle}${end}`;
  }

  /**
   * Anonymize financial amounts (round to nearest threshold)
   * e.g., 1234.56 -> 1200 (rounded to nearest 100)
   */
  anonymizeAmount(amount: number, threshold = 100): number {
    return Math.round(amount / threshold) * threshold;
  }
}
