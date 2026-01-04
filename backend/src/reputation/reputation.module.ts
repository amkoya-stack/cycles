import { Module, forwardRef } from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { BadgeService } from './badge.service';
import { ReputationAutomationService } from './reputation-automation.service';
import { ReputationScheduledService } from './reputation-scheduled.service';
import { ReputationController } from './reputation.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    forwardRef(() => require('../chama/chama.module').ChamaModule),
  ],
  controllers: [ReputationController],
  providers: [
    ReputationService,
    BadgeService,
    ReputationAutomationService,
    ReputationScheduledService,
  ],
  exports: [ReputationService, BadgeService, ReputationAutomationService],
})
export class ReputationModule {}
