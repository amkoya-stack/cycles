import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../services/feature-flags.service';
import { FEATURE_FLAG_KEY, FeatureFlagOptions } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<FeatureFlagOptions>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      // No feature flag required, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const ip = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;

    const isEnabled = await this.featureFlags.isEnabled(options.flagKey, {
      userId,
      ip,
    });

    if (!isEnabled) {
      if (options.fallback !== undefined) {
        return options.fallback;
      }
      throw new ForbiddenException(
        `Feature '${options.flagKey}' is not enabled for your account`,
      );
    }

    return true;
  }
}

