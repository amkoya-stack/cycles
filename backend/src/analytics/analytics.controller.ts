/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AnalyticsService } from './analytics.service';
import { AdminService } from '../admin/admin.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Get user dashboard metrics
   */
  @Get('user')
  async getUserDashboard(@Req() req: any) {
    return this.analyticsService.getUserDashboardMetrics(req.user.id);
  }

  /**
   * Get chama dashboard metrics
   */
  @Get('chama/:chamaId')
  async getChamaDashboard(@Param('chamaId') chamaId: string, @Req() req: any) {
    // Verify user is member of chama
    const db = (this.analyticsService as any).db;
    const membership = await db.query(
      `SELECT id FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, req.user.id],
    );

    if (membership.rows.length === 0) {
      throw new UnauthorizedException('You do not have access to this chama');
    }

    return this.analyticsService.getChamaDashboardMetrics(chamaId);
  }

  /**
   * Get platform dashboard metrics (admin only)
   */
  @Get('platform')
  async getPlatformDashboard(@Req() req: any) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.analyticsService.getPlatformDashboardMetrics();
  }

  /**
   * Get transaction volume over time
   */
  @Get('transactions/volume')
  async getTransactionVolume(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'day',
    @Req() req: any,
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.analyticsService.getTransactionVolume(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      groupBy,
    );
  }

  /**
   * Get geographic distribution
   */
  @Get('geographic')
  async getGeographicDistribution(@Req() req: any) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.analyticsService.getGeographicDistribution();
  }

  /**
   * Get popular chama types
   */
  @Get('chama-types')
  async getPopularChamaTypes(@Req() req: any) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.analyticsService.getPopularChamaTypes();
  }

  /**
   * Get user retention metrics
   */
  @Get('retention')
  async getUserRetention(@Req() req: any) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.analyticsService.getUserRetentionMetrics();
  }

  /**
   * Track analytics event
   */
  @Post('events')
  async trackEvent(
    @Body() body: {
      eventType: string;
      eventName: string;
      chamaId?: string;
      properties?: Record<string, any>;
    },
    @Req() req: any,
  ) {
    await this.analyticsService.trackEvent(
      body.eventType,
      body.eventName,
      req.user.id,
      body.chamaId,
      body.properties,
    );

    return { success: true };
  }
}

