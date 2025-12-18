/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import {
  ActivityService,
  ActivityCategory,
  ActivityType,
} from './activity.service';
import {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
} from './notification.service';
import type { Response } from 'express';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Get activities for a chama
   * GET /api/activity/chama/:chamaId
   */
  @Get('chama/:chamaId')
  async getChamaActivities(
    @Param('chamaId') chamaId: string,
    @Query('category') category?: ActivityCategory,
    @Query('type') activityType?: ActivityType,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.activityService.getActivities({
      chamaId,
      category,
      activityType,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      entityType,
      entityId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get activity details with audit trail
   * GET /api/activity/:activityId
   */
  @Get(':activityId')
  async getActivityDetails(@Param('activityId') activityId: string) {
    return this.activityService.getActivityDetails(activityId);
  }

  /**
   * Get activity statistics
   * GET /api/activity/chama/:chamaId/stats
   */
  @Get('chama/:chamaId/stats')
  async getActivityStats(
    @Param('chamaId') chamaId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.activityService.getActivityStats(
      chamaId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Export activities to CSV
   * GET /api/activity/chama/:chamaId/export
   */
  @Get('chama/:chamaId/export')
  async exportActivities(
    @Param('chamaId') chamaId: string,
    @Res({ passthrough: false }) res: Response,
    @Query('category') category?: ActivityCategory,
    @Query('type') activityType?: ActivityType,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.activityService.exportActivities({
      chamaId,
      category,
      activityType,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="activities-${chamaId}-${Date.now()}.csv"`,
    );
    res.send(csv);
  }

  /**
   * Get user notifications
   * GET /api/activity/notifications
   */
  @Get('notifications/me')
  async getMyNotifications(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationService.getUserNotifications({
      userId: req.user.id,
      status,
      channel,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get notification preferences
   * GET /api/activity/preferences
   */
  @Get('preferences/me')
  async getMyPreferences(@Req() req: any, @Query('chamaId') chamaId?: string) {
    return this.notificationService.getNotificationPreferences(
      req.user.id,
      chamaId,
    );
  }

  /**
   * Update notification preferences
   * PUT /api/activity/preferences
   */
  @Put('preferences/me')
  async updateMyPreferences(
    @Req() req: any,
    @Body('chamaId') chamaId: string | null,
    @Body('pushEnabled') pushEnabled?: boolean,
    @Body('emailEnabled') emailEnabled?: boolean,
    @Body('smsEnabled') smsEnabled?: boolean,
    @Body('activityPreferences') activityPreferences?: Record<string, any>,
    @Body('dailyDigest') dailyDigest?: boolean,
    @Body('weeklyDigest') weeklyDigest?: boolean,
    @Body('digestTime') digestTime?: string,
  ) {
    return this.notificationService.updateNotificationPreferences(
      req.user.id,
      chamaId,
      {
        pushEnabled,
        emailEnabled,
        smsEnabled,
        activityPreferences,
        dailyDigest,
        weeklyDigest,
        digestTime,
      },
    );
  }

  /**
   * Test endpoint to create sample activity
   * POST /api/activity/test
   */
  @Post('test')
  async createTestActivity(
    @Req() req: any,
    @Body('chamaId') chamaId: string,
    @Body('title') title: string,
  ) {
    const activityId = await this.activityService.createActivityLog({
      chamaId,
      userId: req.user.id,
      category: ActivityCategory.SYSTEM,
      activityType: ActivityType.REMINDER_SENT,
      title: title || 'Test Activity',
      description: 'This is a test activity',
      metadata: { test: true },
    });

    // Queue notification
    await this.notificationService.notifyChamaMembers(chamaId, {
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.LOW,
      title: 'Test Notification',
      message: 'This is a test notification',
      activityLogId: activityId,
    });

    return { activityId, message: 'Test activity created' };
  }
}
