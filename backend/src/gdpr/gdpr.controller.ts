import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Body,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GdprService } from './gdpr.service';
import { AdminService } from '../admin/admin.service';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Request data export (GDPR right to data portability)
   */
  @Post('export')
  @RateLimit({ max: 5, window: 3600 }) // 5 requests per hour
  async requestDataExport(
    @Req() req: any,
    @Body() body: {
      exportType?: 'full' | 'partial';
      fieldsRequested?: string[];
    },
  ) {
    return this.gdprService.exportUserData(
      req.user.id,
      body.exportType || 'full',
      body.fieldsRequested,
    );
  }

  /**
   * Get export request status
   */
  @Get('export/:requestId')
  async getExportStatus(
    @Req() req: any,
    @Param('requestId') requestId: string,
  ) {
    return this.gdprService.getExportStatus(requestId, req.user.id);
  }

  /**
   * Request data deletion (GDPR right to be forgotten)
   */
  @Post('delete')
  @RateLimit({ max: 1, window: 3600 }) // 1 request per hour
  async requestDataDeletion(
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.gdprService.requestDataDeletion(req.user.id, reason);
  }

  /**
   * Approve data deletion request (admin only)
   */
  @Post('delete/:requestId/approve')
  @RateLimit({ max: 10, window: 60 }) // 10 approvals per minute
  async approveDataDeletion(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body('scheduleDeletion') scheduleDeletion?: boolean,
  ) {
    const isAdmin = await this.adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    await this.gdprService.approveDataDeletion(
      requestId,
      req.user.id,
      scheduleDeletion !== false,
    );

    return { success: true, message: 'Data deletion approved' };
  }
}

