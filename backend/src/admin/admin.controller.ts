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
  async suspendUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { reason: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.suspendUser(
      req.user.id,
      userId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    return { success: true, message: 'User suspended' };
  }

  /**
   * Verify a user (KYC approval)
   */
  @Put('users/:userId/verify')
  async verifyUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { reason: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.verifyUser(
      req.user.id,
      userId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    return { success: true, message: 'User verified' };
  }

  /**
   * Reject KYC for a user
   */
  @Put('users/:userId/reject-kyc')
  async rejectKYC(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { reason: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.rejectKYC(
      req.user.id,
      userId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    return { success: true, message: 'KYC rejected' };
  }

  // ============================================================================
  // CHAMA MANAGEMENT
  // ============================================================================

  /**
   * Feature a chama
   */
  @Put('chamas/:chamaId/feature')
  async featureChama(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() body: { reason: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.featureChama(
      req.user.id,
      chamaId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    return { success: true, message: 'Chama featured' };
  }

  /**
   * Unfeature a chama
   */
  @Put('chamas/:chamaId/unfeature')
  async unfeatureChama(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() body: { reason: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.unfeatureChama(
      req.user.id,
      chamaId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    return { success: true, message: 'Chama unfeatured' };
  }

  /**
   * Suspend a chama
   */
  @Put('chamas/:chamaId/suspend')
  async suspendChama(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() body: { reason: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.suspendChama(
      req.user.id,
      chamaId,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
    return { success: true, message: 'Chama suspended' };
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
  async resolveFraudAlert(
    @Req() req: any,
    @Param('alertId') alertId: string,
    @Body() body: { status: string; resolutionNotes: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.resolveFraudAlert(
      req.user.id,
      alertId,
      body.status,
      body.resolutionNotes,
    );
    return { success: true, message: 'Fraud alert resolved' };
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
  async reviewContent(
    @Req() req: any,
    @Param('moderationId') moderationId: string,
    @Body() body: { status: string; reviewNotes: string },
  ) {
    await this.checkAdminAccess(req.user.id);
    await this.adminService.reviewContent(
      req.user.id,
      moderationId,
      body.status,
      body.reviewNotes,
    );
    return { success: true, message: 'Content reviewed' };
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
