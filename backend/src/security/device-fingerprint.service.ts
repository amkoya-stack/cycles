import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as crypto from 'crypto';

export interface DeviceInfo {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  canvasFingerprint?: string;
  webglFingerprint?: string;
}

@Injectable()
export class DeviceFingerprintService {
  private readonly logger = new Logger(DeviceFingerprintService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Generate device fingerprint from device info
   */
  generateFingerprint(deviceInfo: DeviceInfo, ipAddress?: string): string {
    // Combine various device attributes to create a unique fingerprint
    const fingerprintData = [
      deviceInfo.userAgent,
      deviceInfo.screenResolution,
      deviceInfo.timezone,
      deviceInfo.language,
      deviceInfo.platform,
      deviceInfo.hardwareConcurrency?.toString(),
      deviceInfo.deviceMemory?.toString(),
      deviceInfo.canvasFingerprint,
      deviceInfo.webglFingerprint,
      ipAddress,
    ]
      .filter(Boolean)
      .join('|');

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Generate device ID (simpler identifier)
   */
  generateDeviceId(deviceInfo: DeviceInfo): string {
    const deviceData = [
      deviceInfo.userAgent,
      deviceInfo.platform,
      deviceInfo.screenResolution,
    ]
      .filter(Boolean)
      .join('-');

    return crypto.createHash('md5').update(deviceData).digest('hex').slice(0, 16);
  }

  /**
   * Register or update device session
   */
  async registerDevice(
    userId: string,
    deviceInfo: DeviceInfo,
    ipAddress?: string,
    deviceName?: string,
  ): Promise<{ sessionId: string; deviceId: string }> {
    const deviceId = this.generateDeviceId(deviceInfo);
    const deviceFingerprint = this.generateFingerprint(deviceInfo, ipAddress);

    // Determine device type
    const userAgent = deviceInfo.userAgent.toLowerCase();
    let deviceType = 'unknown';
    if (/mobile|android|iphone|ipad/.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/.test(userAgent)) {
      deviceType = 'tablet';
    } else if (/desktop|windows|mac|linux/.test(userAgent)) {
      deviceType = 'desktop';
    }

    // Check if device session already exists
    const existing = await this.db.query(
      `SELECT id FROM user_sessions 
       WHERE user_id = $1 AND device_id = $2 AND is_active = TRUE`,
      [userId, deviceId],
    );

    let sessionId: string;

    if (existing.rows.length > 0) {
      // Update existing session
      const result = await this.db.query(
        `UPDATE user_sessions 
         SET device_fingerprint = $1, ip_address = $2, user_agent = $3,
             last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id`,
        [deviceFingerprint, ipAddress, deviceInfo.userAgent, existing.rows[0].id],
      );
      sessionId = result.rows[0].id;
    } else {
      // Create new session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const result = await this.db.query(
        `INSERT INTO user_sessions 
         (user_id, device_id, device_fingerprint, device_name, device_type, 
          ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          userId,
          deviceId,
          deviceFingerprint,
          deviceName || `Device ${deviceId.slice(0, 8)}`,
          deviceType,
          ipAddress,
          deviceInfo.userAgent,
          expiresAt,
        ],
      );
      sessionId = result.rows[0].id;
    }

    return { sessionId, deviceId };
  }

  /**
   * Get user's active devices
   */
  async getUserDevices(userId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT id, device_id, device_name, device_type, ip_address, 
              last_activity_at, created_at
       FROM user_sessions 
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY last_activity_at DESC`,
      [userId],
    );

    return result.rows;
  }

  /**
   * Revoke device session
   */
  async revokeDevice(userId: string, sessionId: string, reason?: string): Promise<void> {
    await this.db.query(
      `UPDATE user_sessions 
       SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP, revoked_reason = $1
       WHERE id = $2 AND user_id = $3`,
      [reason || 'User revoked', sessionId, userId],
    );

    this.logger.log(`Device session ${sessionId} revoked for user ${userId}`);
  }

  /**
   * Revoke all devices except current
   */
  async revokeAllOtherDevices(userId: string, currentSessionId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_sessions 
       SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP, 
           revoked_reason = 'Revoked all other devices'
       WHERE user_id = $1 AND id != $2 AND is_active = TRUE`,
      [userId, currentSessionId],
    );

    this.logger.log(`All other devices revoked for user ${userId}`);
  }
}

