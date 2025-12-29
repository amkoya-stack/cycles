import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'feature_flag';

export interface FeatureFlagOptions {
  flagKey: string;
  fallback?: boolean; // What to return if flag not found (default: false)
}

/**
 * Decorator to protect routes with feature flags
 * Usage: @FeatureFlag({ flagKey: 'new_payment_flow' })
 */
export const FeatureFlag = (options: FeatureFlagOptions) =>
  SetMetadata(FEATURE_FLAG_KEY, options);

