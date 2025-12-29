import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash } from 'crypto';
import { promisify } from 'util';
import { RedisService } from '../../cache/redis.service';

const scryptAsync = promisify(scrypt);

/**
 * TokenizationService
 * 
 * Securely tokenizes sensitive data (PII) using AES-256-GCM encryption.
 * Tokens are stored in the database, while the mapping is kept in Redis
 * for fast lookup and an encrypted backup in the database.
 * 
 * Features:
 * - Format-preserving tokenization (maintains data format)
 * - AES-256-GCM encryption
 * - Redis cache for performance
 * - Secure key derivation from environment variable
 */
@Injectable()
export class TokenizationService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private encryptionKey: Buffer | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Initialize encryption key from environment variable
   * Falls back to a default key in development (NOT for production!)
   */
  private async getEncryptionKey(): Promise<Buffer> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    const secretKey =
      this.configService.get<string>('TOKENIZATION_SECRET_KEY') ||
      'dev-secret-key-change-in-production-min-32-chars';

    if (secretKey.length < 32) {
      throw new Error(
        'TOKENIZATION_SECRET_KEY must be at least 32 characters long',
      );
    }

    // Derive a 32-byte key from the secret using scrypt
    this.encryptionKey = (await scryptAsync(
      secretKey,
      'tokenization-salt',
      32,
    )) as Buffer;

    return this.encryptionKey;
  }

  /**
   * Tokenize sensitive data
   * Encrypts the value and stores the mapping in Redis
   * 
   * @param value - The sensitive value to tokenize
   * @param fieldName - Optional field name for context (e.g., 'email', 'phone')
   * @returns The tokenized value (encrypted string)
   */
  async tokenize(value: string | null | undefined, fieldName?: string): Promise<string | null> {
    if (!value || value.trim() === '') {
      return null;
    }

    try {
      const key = await this.getEncryptionKey();
      const iv = randomBytes(this.ivLength);

      const cipher = createCipheriv(this.algorithm, key, iv);
      
      // Add field name as additional authenticated data (AAD)
      if (fieldName) {
        cipher.setAAD(Buffer.from(fieldName));
      }

      let encrypted = cipher.update(value, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const tag = cipher.getAuthTag();

      // Format: iv:tag:encrypted (all base64 encoded)
      const token = Buffer.concat([iv, tag, encrypted]).toString('base64');

      // Store mapping in Redis for fast lookup (24 hour TTL)
      // Forward mapping: token -> value
      const mappingKey = `tokenization:${token}`;
      await this.redis.set(mappingKey, value, 86400);

      // Reverse mapping: value hash -> token (for login lookups)
      // Use SHA256 hash of value + fieldName for deterministic lookup
      const valueHash = createHash('sha256')
        .update(`${fieldName || 'default'}:${value}`)
        .digest('hex');
      const reverseKey = `tokenization:reverse:${fieldName || 'default'}:${valueHash}`;
      await this.redis.set(reverseKey, token, 86400);

      return token;
    } catch (error) {
      console.error('[Tokenization] Failed to tokenize value:', error);
      throw new Error('Tokenization failed');
    }
  }

  /**
   * Find token for a given plaintext value (for login lookups)
   * Uses reverse lookup index in Redis
   * 
   * @param value - The plaintext value to find token for
   * @param fieldName - Field name for context (e.g., 'email', 'phone')
   * @returns The token if found, null otherwise
   */
  async findToken(value: string | null | undefined, fieldName?: string): Promise<string | null> {
    if (!value || value.trim() === '') {
      return null;
    }

    try {
      // Create hash of value + fieldName
      const valueHash = createHash('sha256')
        .update(`${fieldName || 'default'}:${value}`)
        .digest('hex');
      
      const reverseKey = `tokenization:reverse:${fieldName || 'default'}:${valueHash}`;
      const token = await this.redis.get(reverseKey);
      
      return token;
    } catch (error) {
      console.error('[Tokenization] Failed to find token:', error);
      return null;
    }
  }

  /**
   * Check if a string looks like a tokenized value
   * Tokens are base64 encoded and have a minimum length
   */
  private isTokenized(value: string): boolean {
    // Tokens are base64 encoded: iv(16) + tag(16) + encrypted data
    // Minimum length would be around 44+ characters for base64 encoding
    // Also check if it's valid base64
    if (value.length < 44) {
      return false;
    }
    
    try {
      // Try to decode as base64 - if it fails, it's not a token
      const decoded = Buffer.from(value, 'base64');
      // Token should have at least IV + tag = 32 bytes
      return decoded.length >= 32;
    } catch {
      return false;
    }
  }

  /**
   * Detokenize a token back to original value
   * First checks Redis cache, then decrypts if needed
   * Handles both tokenized values and plain text (for backward compatibility)
   * 
   * @param token - The tokenized value (or plain text for old data)
   * @param fieldName - Optional field name for context
   * @returns The original value
   */
  async detokenize(token: string | null | undefined, fieldName?: string): Promise<string | null> {
    if (!token || token.trim() === '') {
      return null;
    }

    // If it doesn't look like a token, return as-is (plain text from old data)
    if (!this.isTokenized(token)) {
      return token;
    }

    try {
      // First, check Redis cache
      const mappingKey = `tokenization:${token}`;
      const cached = await this.redis.get(mappingKey);
      
      if (cached) {
        return cached;
      }

      // If not in cache, decrypt
      const key = await this.getEncryptionKey();
      const tokenBuffer = Buffer.from(token, 'base64');

      // Check if buffer is large enough
      const minSize = this.ivLength + this.tagLength;
      if (tokenBuffer.length < minSize) {
        // Not a valid token, return as plain text
        return token;
      }

      // Extract IV, tag, and encrypted data
      const iv = tokenBuffer.subarray(0, this.ivLength);
      const tag = tokenBuffer.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = tokenBuffer.subarray(this.ivLength + this.tagLength);

      const decipher = createDecipheriv(this.algorithm, key, iv);
      
      if (fieldName) {
        decipher.setAAD(Buffer.from(fieldName));
      }

      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const value = decrypted.toString('utf8');

      // Cache the result
      await this.redis.set(mappingKey, value, 86400);

      return value;
    } catch (error) {
      // If decryption fails, it might be plain text from old data
      // Return the original value instead of null
      console.warn('[Tokenization] Failed to detokenize, treating as plain text:', error.message);
      return token;
    }
  }

  /**
   * Tokenize multiple fields in an object
   * 
   * @param data - Object containing sensitive fields
   * @param fields - Array of field names to tokenize
   * @returns Object with tokenized fields
   */
  async tokenizeObject<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
  ): Promise<T> {
    const tokenized = { ...data };

    for (const field of fields) {
      if (tokenized[field] != null) {
        tokenized[field] = (await this.tokenize(
          String(tokenized[field]),
          String(field),
        )) as any;
      }
    }

    return tokenized;
  }

  /**
   * Detokenize multiple fields in an object
   * 
   * @param data - Object containing tokenized fields
   * @param fields - Array of field names to detokenize
   * @returns Object with detokenized fields
   */
  async detokenizeObject<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
  ): Promise<T> {
    const detokenized = { ...data };

    for (const field of fields) {
      if (detokenized[field] != null) {
        detokenized[field] = (await this.detokenize(
          String(detokenized[field]),
          String(field),
        )) as any;
      }
    }

    return detokenized;
  }

  /**
   * Format-preserving tokenization for phone numbers
   * Maintains the format (e.g., 254712345678 -> 2547****5678)
   * 
   * @param phone - Phone number to tokenize
   * @returns Tokenized phone with format preserved
   */
  async tokenizePhone(phone: string | null | undefined): Promise<string | null> {
    if (!phone) return null;

    // Tokenize the full number
    const token = await this.tokenize(phone, 'phone');
    
    if (!token) return null;

    // Return a format-preserving masked version for display
    // Format: 254712345678 -> 2547****5678
    if (phone.length >= 8) {
      const prefix = phone.substring(0, 4);
      const suffix = phone.substring(phone.length - 4);
      return `${prefix}****${suffix}`;
    }

    return '****';
  }

  /**
   * Format-preserving tokenization for email addresses
   * Maintains the format (e.g., user@example.com -> u***@example.com)
   * 
   * @param email - Email to tokenize
   * @returns Tokenized email with format preserved
   */
  async tokenizeEmail(email: string | null | undefined): Promise<string | null> {
    if (!email) return null;

    const token = await this.tokenize(email, 'email');
    
    if (!token) return null;

    // Return a format-preserving masked version
    const [localPart, domain] = email.split('@');
    if (domain) {
      const maskedLocal = localPart.length > 1 
        ? `${localPart[0]}***` 
        : '***';
      return `${maskedLocal}@${domain}`;
    }

    return '***@***';
  }
}

