import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FeatureFlagsService, FeatureFlagStatus } from '../common/services/feature-flags.service';
import type { CreateFeatureFlagDto, UpdateFeatureFlagDto } from '../common/services/feature-flags.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller({ path: 'admin/feature-flags', version: '1' })
@UseGuards(JwtAuthGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  /**
   * List all feature flags
   * GET /api/v1/admin/feature-flags?status=active
   */
  @Get()
  async listFlags(@Query('status') status?: FeatureFlagStatus) {
    return await this.featureFlags.listFlags(status);
  }

  /**
   * Get a specific feature flag
   * GET /api/v1/admin/feature-flags/:key
   */
  @Get(':key')
  async getFlag(@Param('key') key: string) {
    const flag = await this.featureFlags.getFlag(key);
    if (!flag) {
      throw new Error(`Feature flag '${key}' not found`);
    }
    return flag;
  }

  /**
   * Create a new feature flag
   * POST /api/v1/admin/feature-flags
   */
  @Post()
  async createFlag(@Body() dto: CreateFeatureFlagDto, @Request() req: any) {
    return await this.featureFlags.createFlag({
      ...dto,
      createdBy: req.user?.id,
    });
  }

  /**
   * Update a feature flag
   * PUT /api/v1/admin/feature-flags/:key
   */
  @Put(':key')
  async updateFlag(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return await this.featureFlags.updateFlag(key, dto);
  }

  /**
   * Delete/Archive a feature flag
   * DELETE /api/v1/admin/feature-flags/:key
   */
  @Delete(':key')
  async deleteFlag(@Param('key') key: string) {
    await this.featureFlags.deleteFlag(key);
    return { message: 'Feature flag archived successfully' };
  }

  /**
   * Check if a feature is enabled (for testing)
   * GET /api/v1/admin/feature-flags/:key/check?userId=xxx&ip=xxx
   */
  @Get(':key/check')
  async checkFlag(
    @Param('key') key: string,
    @Query('userId') userId?: string,
    @Query('ip') ip?: string,
  ) {
    const isEnabled = await this.featureFlags.isEnabled(key, { userId, ip });
    return {
      key,
      enabled: isEnabled,
      context: { userId, ip },
    };
  }
}

