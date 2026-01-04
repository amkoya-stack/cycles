import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  UseGuards,
  Req,
  Body,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TransactionPinService } from './transaction-pin.service';
import { DeviceFingerprintService, DeviceInfo } from './device-fingerprint.service';
import { WithdrawalLimitsService } from './withdrawal-limits.service';
import { IpWhitelistService } from './ip-whitelist.service';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { AdminService } from '../admin/admin.service';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(
    private readonly transactionPin: TransactionPinService,
    private readonly deviceFingerprint: DeviceFingerprintService,
    private readonly withdrawalLimits: WithdrawalLimitsService,
    private readonly ipWhitelist: IpWhitelistService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Set transaction PIN
   */
  @Post('pin/set')
  @RateLimit({ max: 5, window: 3600 }) // 5 attempts per hour
  async setPin(
    @Req() req: any,
    @Body() body: { pin: string; currentPin?: string },
  ) {
    await this.transactionPin.setPin(req.user.id, body.pin, body.currentPin);
    return { success: true, message: 'Transaction PIN set successfully' };
  }

  /**
   * Verify transaction PIN
   */
  @Post('pin/verify')
  @RateLimit({ max: 10, window: 60 }) // 10 verifications per minute
  async verifyPin(
    @Req() req: any,
    @Body() body: { pin: string },
  ) {
    const isValid = await this.transactionPin.verifyPin(req.user.id, body.pin);
    if (!isValid) {
      throw new UnauthorizedException('Invalid PIN');
    }
    return { verified: true };
  }

  /**
   * Check if PIN is set
   */
  @Get('pin/status')
  async hasPin(@Req() req: any) {
    const hasPin = await this.transactionPin.hasPin(req.user.id);
    return { hasPin };
  }

  /**
   * Register device and create session
   */
  @Post('device/register')
  @RateLimit({ max: 10, window: 3600 }) // 10 registrations per hour
  async registerDevice(
    @Req() req: any,
    @Body() body: {
      deviceInfo: DeviceInfo;
      deviceName?: string;
    },
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const result = await this.deviceFingerprint.registerDevice(
      req.user.id,
      body.deviceInfo,
      ipAddress,
      body.deviceName,
    );
    return result;
  }

  /**
   * Get user's active devices
   */
  @Get('devices')
  async getUserDevices(@Req() req: any) {
    return this.deviceFingerprint.getUserDevices(req.user.id);
  }

  /**
   * Revoke device session
   */
  @Delete('devices/:sessionId')
  async revokeDevice(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body('reason') reason?: string,
  ) {
    await this.deviceFingerprint.revokeDevice(req.user.id, sessionId, reason);
    return { success: true, message: 'Device revoked successfully' };
  }

  /**
   * Revoke all other devices
   */
  @Post('devices/revoke-all')
  async revokeAllDevices(
    @Req() req: any,
    @Body('currentSessionId') currentSessionId: string,
  ) {
    await this.deviceFingerprint.revokeAllOtherDevices(req.user.id, currentSessionId);
    return { success: true, message: 'All other devices revoked successfully' };
  }

  /**
   * Get withdrawal limits
   */
  @Get('withdrawal-limits')
  async getWithdrawalLimits(@Req() req: any) {
    return this.withdrawalLimits.getLimits(req.user.id);
  }

  /**
   * Add IP to whitelist (admin only)
   */
  @Post('ip-whitelist')
  async addIpToWhitelist(
    @Req() req: any,
    @Body() body: { ipAddress: string; ipRange?: string; description?: string },
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.ipWhitelist.addIp(
      req.user.id,
      body.ipAddress,
      body.ipRange,
      body.description,
    );
  }

  /**
   * Get whitelisted IPs (admin only)
   */
  @Get('ip-whitelist')
  async getWhitelistedIps(@Req() req: any) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.ipWhitelist.getWhitelistedIps(req.user.id);
  }

  /**
   * Remove IP from whitelist (admin only)
   */
  @Delete('ip-whitelist/:whitelistId')
  async removeIpFromWhitelist(
    @Req() req: any,
    @Param('whitelistId') whitelistId: string,
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    await this.ipWhitelist.removeIp(req.user.id, whitelistId);
    return { success: true, message: 'IP removed from whitelist' };
  }
}

