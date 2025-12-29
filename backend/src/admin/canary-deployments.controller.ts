import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CanaryDeploymentService } from '../common/services/canary-deployment.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller({ path: 'admin/canary-deployments', version: '1' })
@UseGuards(JwtAuthGuard)
export class CanaryDeploymentsController {
  constructor(private readonly canary: CanaryDeploymentService) {}

  /**
   * List all active canary deployments
   * GET /api/v1/admin/canary-deployments
   */
  @Get()
  async listCanaries() {
    return await this.canary.listActiveCanaries();
  }

  /**
   * Get canary deployment status
   * GET /api/v1/admin/canary-deployments/:featureKey
   */
  @Get(':featureKey')
  async getCanary(@Param('featureKey') featureKey: string) {
    const canary = await this.canary.getCanary(featureKey);
    if (!canary) {
      throw new Error(`No active canary deployment found for '${featureKey}'`);
    }
    return canary;
  }

  /**
   * Start a canary deployment
   * POST /api/v1/admin/canary-deployments
   */
  @Post()
  async startCanary(
    @Body()
    dto: {
      featureKey: string;
      version: string;
      initialPercentage?: number;
      rollbackThreshold?: number;
    },
    @Request() req: any,
  ) {
    return await this.canary.startCanary(
      dto.featureKey,
      dto.version,
      dto.initialPercentage || 5,
      dto.rollbackThreshold || 5,
      req.user?.id,
    );
  }

  /**
   * Increase canary percentage
   * PUT /api/v1/admin/canary-deployments/:featureKey/increase
   */
  @Put(':featureKey/increase')
  async increasePercentage(
    @Param('featureKey') featureKey: string,
    @Body() dto: { percentage: number },
  ) {
    return await this.canary.increasePercentage(featureKey, dto.percentage);
  }

  /**
   * Rollback canary deployment
   * POST /api/v1/admin/canary-deployments/:featureKey/rollback
   */
  @Post(':featureKey/rollback')
  async rollback(
    @Param('featureKey') featureKey: string,
    @Body() dto: { reason?: string },
    @Request() req: any,
  ) {
    await this.canary.rollback(
      featureKey,
      dto.reason || 'Manual rollback',
    );
    return { message: 'Canary deployment rolled back successfully' };
  }

  /**
   * Complete canary (100% rollout)
   * POST /api/v1/admin/canary-deployments/:featureKey/complete
   */
  @Post(':featureKey/complete')
  async complete(@Param('featureKey') featureKey: string) {
    await this.canary.complete(featureKey);
    return { message: 'Canary deployment completed (100% rollout)' };
  }
}

