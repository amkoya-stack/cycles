import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TransactionPinService {
  private readonly logger = new Logger(TransactionPinService.name);
  private readonly saltRounds = 10;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Set or update transaction PIN (6-digit)
   */
  async setPin(userId: string, pin: string, currentPin?: string): Promise<void> {
    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN must be exactly 6 digits');
    }

    // If updating, verify current PIN
    if (currentPin) {
      const isValid = await this.verifyPin(userId, currentPin);
      if (!isValid) {
        throw new UnauthorizedException('Current PIN is incorrect');
      }
    }

    // Hash PIN
    const pinHash = await bcrypt.hash(pin, this.saltRounds);

    // Update user record
    await this.db.query(
      `UPDATE users 
       SET transaction_pin_hash = $1, transaction_pin_set_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [pinHash, userId],
    );

    this.logger.log(`Transaction PIN set for user ${userId}`);
  }

  /**
   * Verify transaction PIN
   */
  async verifyPin(userId: string, pin: string): Promise<boolean> {
    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      return false;
    }

    // Get user's PIN hash
    const result = await this.db.query(
      `SELECT transaction_pin_hash FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0 || !result.rows[0].transaction_pin_hash) {
      return false;
    }

    const pinHash = result.rows[0].transaction_pin_hash;

    // Verify PIN
    return bcrypt.compare(pin, pinHash);
  }

  /**
   * Check if user has set a transaction PIN
   */
  async hasPin(userId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT transaction_pin_hash FROM users WHERE id = $1`,
      [userId],
    );

    return (
      result.rows.length > 0 && result.rows[0].transaction_pin_hash !== null
    );
  }

  /**
   * Reset transaction PIN (requires admin or 2FA verification)
   */
  async resetPin(
    userId: string,
    newPin: string,
    resetByUserId: string,
    isAdmin: boolean = false,
  ): Promise<void> {
    // Validate PIN format
    if (!/^\d{6}$/.test(newPin)) {
      throw new BadRequestException('PIN must be exactly 6 digits');
    }

    // Only allow self-reset or admin reset
    if (userId !== resetByUserId && !isAdmin) {
      throw new UnauthorizedException('Only admins can reset other users\' PINs');
    }

    // Hash new PIN
    const pinHash = await bcrypt.hash(newPin, this.saltRounds);

    // Update user record
    await this.db.query(
      `UPDATE users 
       SET transaction_pin_hash = $1, transaction_pin_set_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [pinHash, userId],
    );

    this.logger.log(`Transaction PIN reset for user ${userId} by ${resetByUserId}`);
  }
}

