import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Req,
  Body,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AmlMonitoringService } from './aml-monitoring.service';
import { AdminService } from '../admin/admin.service';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('aml')
@UseGuards(JwtAuthGuard)
export class AmlController {
  constructor(
    private readonly amlService: AmlMonitoringService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Get AML alerts (admin only)
   */
  @Get('alerts')
  @RateLimit({ max: 60, window: 60 }) // 60 requests per minute
  async getAlerts(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: number,
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.amlService.getAlerts(
      undefined, // Get all users' alerts for admin
      status,
      severity,
      limit || 50,
    );
  }

  /**
   * Get user's AML alerts
   */
  @Get('alerts/my')
  @RateLimit({ max: 30, window: 60 }) // 30 requests per minute
  async getMyAlerts(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    return this.amlService.getAlerts(req.user.id, status, undefined, 20);
  }

  /**
   * Resolve AML alert (admin only)
   */
  @Put('alerts/:alertId/resolve')
  @RateLimit({ max: 20, window: 60 }) // 20 resolutions per minute
  async resolveAlert(
    @Req() req: any,
    @Param('alertId') alertId: string,
    @Body() body: {
      resolutionNotes: string;
      status?: 'resolved' | 'false_positive';
    },
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    await this.amlService.resolveAlert(
      alertId,
      req.user.id,
      body.resolutionNotes,
      body.status || 'resolved',
    );

    return { success: true, message: 'Alert resolved' };
  }

  /**
   * Screen user against watchlists (admin only)
   */
  @Post('screen/:userId')
  @RateLimit({ max: 10, window: 60 }) // 10 screenings per minute
  async screenUser(
    @Req() req: any,
    @Param('userId') userId: string,
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.amlService.screenUser(userId);
  }
}

