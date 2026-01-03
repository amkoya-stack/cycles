import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DisputeService } from './dispute.service';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard)
export class DisputeAdminController {
  constructor(private readonly disputeService: DisputeService) {}

  /**
   * Get all escalated disputes (platform admin only)
   */
  @Get('escalated')
  async getEscalatedDisputes(
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    // TODO: Verify user is platform admin
    return this.disputeService.getEscalatedDisputes(limit || 50, offset || 0);
  }

  /**
   * Review escalated dispute
   */
  @Put(':id/review')
  async reviewEscalatedDispute(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { decision: string; platformAction?: Record<string, any> },
  ) {
    // TODO: Verify user is platform admin
    return this.disputeService.reviewEscalatedDispute(req.user.id, id, body.decision, body.platformAction);
  }

  /**
   * Get dispute analytics
   */
  @Get('analytics')
  async getDisputeAnalytics(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // TODO: Verify user is platform admin
    return this.disputeService.getDisputeAnalytics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}

