import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RollbackService, RollbackType } from '../common/services/rollback.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller({ path: 'admin/rollbacks', version: '1' })
@UseGuards(JwtAuthGuard)
export class RollbacksController {
  constructor(private readonly rollback: RollbackService) {}

  /**
   * List recent rollbacks
   * GET /api/v1/admin/rollbacks?limit=50
   */
  @Get()
  async listRollbacks(@Query('limit') limit?: number) {
    return await this.rollback.listRollbacks(limit ? parseInt(limit.toString()) : 50);
  }

  /**
   * Get rollback details
   * GET /api/v1/admin/rollbacks/:id
   */
  @Get(':id')
  async getRollback(@Param('id') id: string) {
    const record = await this.rollback.getRollback(id);
    if (!record) {
      throw new Error(`Rollback record '${id}' not found`);
    }
    return record;
  }

  /**
   * Rollback a feature flag
   * POST /api/v1/admin/rollbacks/feature-flag
   */
  @Post('feature-flag')
  async rollbackFeatureFlag(
    @Body() dto: { featureKey: string; reason: string },
    @Request() req: any,
  ) {
    return await this.rollback.rollbackFeatureFlag(
      dto.featureKey,
      dto.reason,
      req.user?.id,
    );
  }

  /**
   * Rollback a canary deployment
   * POST /api/v1/admin/rollbacks/canary
   */
  @Post('canary')
  async rollbackCanary(
    @Body() dto: { featureKey: string; reason: string },
    @Request() req: any,
  ) {
    return await this.rollback.rollbackCanary(
      dto.featureKey,
      dto.reason,
      req.user?.id,
    );
  }
}

