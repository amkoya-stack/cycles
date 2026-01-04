/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminService } from './admin.service';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { FeatureFlag } from '../common/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../common/guards/feature-flag.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get all transactions with filters
   * Only accessible by admin users
   */
  @Get('transactions')
  async getAllTransactions(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.checkAdminAccess(req.user.id);

    return this.adminService.getAllTransactions({
      page: parseInt(page || '1') || 1,
      limit: parseInt(limit || '50') || 50,
      status,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Get system statistics
   */
  @Get('stats')
  async getSystemStats(@Req() req: any) {
    await this.checkAdminAccess(req.user.id);
    return this.adminService.getSystemStats();
  }

  /**
   * Get reconciliation reports
   */
  @Get('reconciliation')
  async getReconciliationReports(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.checkAdminAccess(req.user.id);

    return this.adminService.getReconciliationReports({
      page: parseInt(page || '1') || 1,
      limit: parseInt(limit || '20') || 20,
    });
  }

  /**
   * Get reconciliation details by ID
   */
  @Get('reconciliation/:id')
  async getReconciliationDetails(@Req() req: any, @Query('id') id: string) {
    await this.checkAdminAccess(req.user.id);
    return this.adminService.getReconciliationDetails(id);
  }

  /**
   * Get failed M-Pesa callbacks
   */
  @Get('failed-callbacks')
  async getFailedCallbacks(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.checkAdminAccess(req.user.id);

    return this.adminService.getFailedCallbacks({
      page: parseInt(page || '1') || 1,
      limit: parseInt(limit || '50') || 50,
    });
  }

  /**
   * Get user analytics
   */
  @Get('users/analytics')
  async getUserAnalytics(@Req() req: any) {
    await this.checkAdminAccess(req.user.id);
    return this.adminService.getUserAnalytics();
  }

  /**   * Process pending reputation events
   */
  @Get('reputation/process-pending')
  async processPendingReputationEvents(@Req() req: any) {
    await this.checkAdminAccess(req.user.id);
    // This will be implemented when reputation automation is properly wired
    return {
      success: true,
      message: 'Reputation processing endpoint - to be implemented',
    };
  }

  /**
   * Calculate chama metrics
   */
  @Get('chama-metrics/calculate-all')
  async calculateAllChamaMetrics(@Req() req: any) {
    await this.checkAdminAccess(req.user.id);
    // This will be implemented when chama metrics service is properly wired
    return {
      success: true,
      message: 'Chama metrics calculation endpoint - to be implemented',
    };
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Suspend a user
   */
  @Put('users/:userId/suspend')
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag({ flagKey: 'admin_user_suspend', fallback: false })
  @RateLimit({ max: 5, window: 60 }) // 5 suspensions per minute
  async suspendUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { reason: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.suspendUser(
      req.user.id,
      userId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'User already suspended (duplicate request)'
        : 'User suspended',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  /**
   * Verify a user (KYC approval)
   */
  @Put('users/:userId/verify')
  @RateLimit({ max: 10, window: 60 }) // 10 verifications per minute
  async verifyUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { reason: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.verifyUser(
      req.user.id,
      userId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'User already verified (duplicate request)'
        : 'User verified',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  /**
   * Reject KYC for a user
   */
  @Put('users/:userId/reject-kyc')
  @RateLimit({ max: 10, window: 60 }) // 10 rejections per minute
  async rejectKYC(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { reason: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.rejectKYC(
      req.user.id,
      userId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
      idempotencyKey,
    );
    
    return {
      success: true,
      message: 'KYC rejected',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  // ============================================================================
  // CHAMA MANAGEMENT
  // ============================================================================

  /**
   * Feature a chama
   */
  @Put('chamas/:chamaId/feature')
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag({ flagKey: 'admin_chama_feature', fallback: false })
  @RateLimit({ max: 10, window: 60 }) // 10 features per minute
  async featureChama(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() body: { reason: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.featureChama(
      req.user.id,
      chamaId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'Chama already featured (duplicate request)'
        : 'Chama featured',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  /**
   * Unfeature a chama
   */
  @Put('chamas/:chamaId/unfeature')
  @RateLimit({ max: 10, window: 60 }) // 10 unfeatures per minute
  async unfeatureChama(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() body: { reason: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.unfeatureChama(
      req.user.id,
      chamaId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'Chama already unfeatured (duplicate request)'
        : 'Chama unfeatured',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  /**
   * Suspend a chama
   */
  @Put('chamas/:chamaId/suspend')
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag({ flagKey: 'admin_chama_suspend', fallback: false })
  @RateLimit({ max: 5, window: 60 }) // 5 suspensions per minute
  async suspendChama(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() body: { reason: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.suspendChama(
      req.user.id,
      chamaId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'Chama already suspended (duplicate request)'
        : 'Chama suspended',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  // ============================================================================
  // FRAUD DETECTION
  // ============================================================================

  /**
   * Get fraud alerts
   */
  @Get('fraud-alerts')
  async getFraudAlerts(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    await this.checkAdminAccess(req.user.id);
    return this.adminService.getFraudAlerts(
      status,
      severity,
      parseInt(limit || '50'),
      parseInt(offset || '0'),
    );
  }

  /**
   * Resolve fraud alert
   */
  @Put('fraud-alerts/:alertId/resolve')
  @RateLimit({ max: 20, window: 60 }) // 20 resolutions per minute
  async resolveFraudAlert(
    @Req() req: any,
    @Param('alertId') alertId: string,
    @Body() body: { status: string; resolutionNotes: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.resolveFraudAlert(
      req.user.id,
      alertId,
      body.status,
      body.resolutionNotes,
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'Fraud alert already resolved (duplicate request)'
        : 'Fraud alert resolved',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  // ============================================================================
  // CONTENT MODERATION
  // ============================================================================

  /**
   * Get content moderation queue
   */
  @Get('content-moderation')
  async getContentModerationQueue(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    await this.checkAdminAccess(req.user.id);
    return this.adminService.getContentModerationQueue(
      status,
      parseInt(limit || '50'),
      parseInt(offset || '0'),
    );
  }

  /**
   * Review content moderation item
   */
  @Put('content-moderation/:moderationId/review')
  @RateLimit({ max: 30, window: 60 }) // 30 reviews per minute
  async reviewContent(
    @Req() req: any,
    @Param('moderationId') moderationId: string,
    @Body() body: { status: string; reviewNotes: string; idempotencyKey?: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    
    const idempotencyKey =
      body.idempotencyKey || req.headers['idempotency-key'];
    
    const result = await this.adminService.reviewContent(
      req.user.id,
      moderationId,
      body.status,
      body.reviewNotes,
      idempotencyKey,
    );
    
    return {
      success: true,
      message: result.isDuplicate
        ? 'Content already reviewed (duplicate request)'
        : 'Content reviewed',
      actionId: result.actionId,
      isDuplicate: result.isDuplicate,
    };
  }

  // ============================================================================
  // ADMIN ACTION LOG
  // ============================================================================

  /**
   * Get admin action log
   */
  @Get('actions')
  async getAdminActionLog(
    @Req() req: any,
    @Query('adminUserId') adminUserId?: string,
    @Query('actionType') actionType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    await this.checkAdminAccess(req.user.id);
    return this.adminService.getAdminActionLog(
      adminUserId,
      actionType,
      parseInt(limit || '50'),
      parseInt(offset || '0'),
    );
  }

  /**   * Check if user is admin
   * For now, check if email ends with @cycle.com or is specific admin email
   * In production, use a proper admin role system
   */
  private async checkAdminAccess(userId: string): Promise<void> {
    const isAdmin = await this.adminService.isAdmin(userId);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }
  }
}
