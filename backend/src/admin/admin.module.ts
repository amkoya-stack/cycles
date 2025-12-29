import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { CanaryDeploymentsController } from './canary-deployments.controller';
import { RollbacksController } from './rollbacks.controller';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [
    AdminController,
    FeatureFlagsController,
    CanaryDeploymentsController,
    RollbacksController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
