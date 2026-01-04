import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class IpWhitelistService {
  private readonly logger = new Logger(IpWhitelistService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if IP is whitelisted for admin
   */
  async isIpWhitelisted(adminUserId: string, ipAddress: string): Promise<boolean> {
    // Get all active whitelist entries for admin
    const result = await this.db.query(
      `SELECT ip_address, ip_range FROM admin_ip_whitelist 
       WHERE admin_user_id = $1 AND is_active = TRUE`,
      [adminUserId],
    );

    if (result.rows.length === 0) {
      return false; // No whitelist = IP whitelisting not enforced
    }

    // Check if IP matches any whitelist entry
    for (const entry of result.rows) {
      if (entry.ip_address === ipAddress) {
        return true;
      }

      // Check CIDR range if specified
      if (entry.ip_range) {
        // Simple CIDR check (in production, use a proper CIDR library)
        if (this.isIpInRange(ipAddress, entry.ip_range)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Add IP to whitelist
   */
  async addIp(
    adminUserId: string,
    ipAddress: string,
    ipRange?: string,
    description?: string,
    createdByUserId: string = adminUserId,
  ): Promise<{ id: string }> {
    // Validate IP address format
    if (!this.isValidIp(ipAddress) && !ipRange) {
      throw new BadRequestException('Invalid IP address format');
    }

    // Check if already exists
    const existing = await this.db.query(
      `SELECT id FROM admin_ip_whitelist 
       WHERE admin_user_id = $1 AND ip_address = $2 AND is_active = TRUE`,
      [adminUserId, ipAddress],
    );

    if (existing.rows.length > 0) {
      throw new BadRequestException('IP address already whitelisted');
    }

    const result = await this.db.query(
      `INSERT INTO admin_ip_whitelist 
       (admin_user_id, ip_address, ip_range, description, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [adminUserId, ipAddress, ipRange || null, description || null, createdByUserId],
    );

    this.logger.log(`IP ${ipAddress} added to whitelist for admin ${adminUserId}`);

    return { id: result.rows[0].id };
  }

  /**
   * Remove IP from whitelist
   */
  async removeIp(adminUserId: string, whitelistId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE admin_ip_whitelist 
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND admin_user_id = $2
       RETURNING id`,
      [whitelistId, adminUserId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Whitelist entry not found');
    }

    this.logger.log(`IP whitelist entry ${whitelistId} removed for admin ${adminUserId}`);
  }

  /**
   * Get whitelisted IPs for admin
   */
  async getWhitelistedIps(adminUserId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT id, ip_address, ip_range, description, is_active, created_at
       FROM admin_ip_whitelist 
       WHERE admin_user_id = $1
       ORDER BY created_at DESC`,
      [adminUserId],
    );

    return result.rows;
  }

  /**
   * Validate IP address format
   */
  private isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is in CIDR range (simplified version)
   */
  private isIpInRange(ip: string, cidr: string): boolean {
    // In production, use a proper CIDR library like 'ipaddr.js'
    // This is a simplified version
    try {
      const [rangeIp, prefix] = cidr.split('/');
      if (!prefix) return ip === rangeIp;

      // Simple IPv4 CIDR check
      const ipParts = ip.split('.').map(Number);
      const rangeParts = rangeIp.split('.').map(Number);
      const prefixNum = parseInt(prefix);

      if (prefixNum > 32) return false;

      const mask = (0xffffffff << (32 - prefixNum)) >>> 0;

      const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
      const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];

      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }
}

