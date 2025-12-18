/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
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
