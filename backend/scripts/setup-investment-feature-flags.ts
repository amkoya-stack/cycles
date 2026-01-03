/**
 * Setup Investment Module Feature Flags
 * 
 * This script creates the required feature flags for the investment module.
 * Run with: npx ts-node scripts/setup-investment-feature-flags.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FeatureFlagsService, FeatureFlagType, FeatureFlagStatus } from '../src/common/services/feature-flags.service';

async function setupFeatureFlags() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const featureFlagsService = app.get(FeatureFlagsService);

  console.log('🚀 Setting up Investment Module Feature Flags...\n');

  const flags = [
    {
      key: 'investment_module_enabled',
      name: 'Investment Module',
      description: 'Master switch for the investment module. When disabled, all investment features are unavailable.',
      type: FeatureFlagType.BOOLEAN,
      enabled: true,
      status: FeatureFlagStatus.ACTIVE,
    },
    {
      key: 'investment_execution_enabled',
      name: 'Investment Execution',
      description: 'Controls investment execution (fund transfer and activation). When disabled, investments cannot be executed.',
      type: FeatureFlagType.BOOLEAN,
      enabled: true,
      status: FeatureFlagStatus.ACTIVE,
    },
    {
      key: 'dividend_distribution_enabled',
      name: 'Dividend Distribution',
      description: 'Controls dividend/interest distribution. When disabled, dividends cannot be distributed.',
      type: FeatureFlagType.BOOLEAN,
      enabled: true,
      status: FeatureFlagStatus.ACTIVE,
    },
    {
      key: 'external_investment_integrations_enabled',
      name: 'External Investment Integrations',
      description: 'Controls external investment partner integrations (banks, platforms, asset managers).',
      type: FeatureFlagType.BOOLEAN,
      enabled: true,
      status: FeatureFlagStatus.ACTIVE,
    },
  ];

  for (const flag of flags) {
    try {
      // Check if flag already exists
      const existing = await featureFlagsService.getFlag(flag.key);
      
      if (existing) {
        // Update existing flag
        await featureFlagsService.updateFlag(flag.key, {
          name: flag.name,
          description: flag.description,
          enabled: flag.enabled,
          status: flag.status,
        });
        console.log(`✅ Updated feature flag: ${flag.key}`);
      } else {
        // Create new flag
        await featureFlagsService.createFlag({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          type: flag.type,
          enabled: flag.enabled,
        });
        
        // Update status to active
        await featureFlagsService.updateFlag(flag.key, {
          status: flag.status,
        });
        
        console.log(`✅ Created feature flag: ${flag.key}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to setup feature flag ${flag.key}:`, error.message);
    }
  }

  console.log('\n✨ Feature flags setup complete!');
  console.log('\n📋 Created/Updated Flags:');
  for (const flag of flags) {
    const flagData = await featureFlagsService.getFlag(flag.key);
    console.log(`   - ${flag.key}: ${flagData?.enabled ? '✅ Enabled' : '❌ Disabled'} (${flagData?.status})`);
  }

  await app.close();
}

setupFeatureFlags()
  .then(() => {
    console.log('\n✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });

