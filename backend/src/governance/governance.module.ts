import { Module } from '@nestjs/common';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
