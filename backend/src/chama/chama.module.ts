import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { MpesaModule } from '../mpesa/mpesa.module';
import { ReputationModule } from '../reputation/reputation.module';
import { ActivityModule } from '../activity/activity.module';
import { CommonModule } from '../common/common.module';
import { ChamaController } from './chama.controller';
import { ChamaService } from './chama.service';
import { ContributionService } from './contribution.service';
import { ReminderService } from './reminder.service';
import { AutoDebitService } from './auto-debit.service';
import { RotationService } from './rotation.service';
import { PayoutService } from './payout.service';
import { PayoutProcessorService } from './payout.processor.service';
import { ChamaMetricsService } from './chama-metrics.service';
import { ChamaReputationService } from './chama-reputation.service';
import { CommunityService } from './community.service';
import { ClassroomService } from './classroom.service';
import { RotationController } from './rotation.controller';
import { PayoutController } from './payout.controller';
import { ChamaMetricsController } from './chama-metrics.controller';
import { CommunityController } from './community.controller';
import { ClassroomController } from './classroom.controller';
import { DisputeModule } from '../dispute/dispute.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    LedgerModule,
    WalletModule,
    MpesaModule,
    ReputationModule,
    ActivityModule,
    DisputeModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    ChamaController,
    RotationController,
    PayoutController,
    ChamaMetricsController,
    CommunityController,
    ClassroomController,
  ],
  providers: [
    ChamaService,
    ContributionService,
    ReminderService,
    AutoDebitService,
    RotationService,
    PayoutService,
    PayoutProcessorService,
    ChamaMetricsService,
    ChamaReputationService,
    CommunityService,
    ClassroomService,
  ],
  exports: [
    ChamaService,
    RotationService,
    PayoutService,
    ChamaMetricsService,
    ChamaReputationService,
  ],
})
export class ChamaModule {}
