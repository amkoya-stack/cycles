import { Module, forwardRef } from '@nestjs/common';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [DatabaseModule, ActivityModule, forwardRef(() => LedgerModule)],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
