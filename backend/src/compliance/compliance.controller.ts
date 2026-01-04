import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Query,
  Body,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RegulatoryReportsService } from './regulatory-reports.service';
import { DataRetentionService } from '../gdpr/data-retention.service';
import { AdminService } from '../admin/admin.service';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Inject } from '@nestjs/common';

@Controller('compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(
    private readonly reportsService: RegulatoryReportsService,
    @Inject(DataRetentionService) private readonly retentionService: DataRetentionService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Generate suspicious activity report (admin only)
   */
  @Post('reports/suspicious-activity')
  @RateLimit({ max: 5, window: 3600 }) // 5 reports per hour
  async generateSuspiciousActivityReport(
    @Req() req: any,
    @Body() body: { startDate: string; endDate: string },
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.reportsService.generateSuspiciousActivityReport(
      new Date(body.startDate),
      new Date(body.endDate),
      req.user.id,
    );
  }

  /**
   * Generate large cash transaction report (admin only)
   */
  @Post('reports/large-cash')
  @RateLimit({ max: 5, window: 3600 }) // 5 reports per hour
  async generateLargeCashReport(
    @Req() req: any,
    @Body() body: { startDate: string; endDate: string },
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.reportsService.generateLargeCashReport(
      new Date(body.startDate),
      new Date(body.endDate),
      req.user.id,
    );
  }

  /**
   * Get all reports (admin only)
   */
  @Get('reports')
  @RateLimit({ max: 30, window: 60 }) // 30 requests per minute
  async getReports(@Req() req: any, @Query('limit') limit?: number) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.reportsService.getReports(limit ? parseInt(limit.toString()) : 50);
  }

  /**
   * Get report by ID (admin only)
   */
  @Get('reports/:reportId')
  @RateLimit({ max: 30, window: 60 }) // 30 requests per minute
  async getReport(@Req() req: any, @Param('reportId') reportId: string) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.reportsService.getReport(reportId);
  }

  /**
   * Get data retention policies (admin only)
   */
  @Get('retention-policies')
  @RateLimit({ max: 30, window: 60 }) // 30 requests per minute
  async getRetentionPolicies(@Req() req: any) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    return this.retentionService.getPolicies();
  }

  /**
   * Create or update retention policy (admin only)
   */
  @Post('retention-policies')
  @RateLimit({ max: 10, window: 3600 }) // 10 updates per hour
  async createOrUpdatePolicy(
    @Req() req: any,
    @Body() body: {
      dataType: string;
      retentionPeriodDays: number;
      autoDelete: boolean;
      description?: string;
    },
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    await this.retentionService.createOrUpdatePolicy(
      body.dataType,
      body.retentionPeriodDays,
      body.autoDelete,
      body.description,
    );

    return { success: true, message: 'Retention policy updated' };
  }
}

