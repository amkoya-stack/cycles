import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { MpesaModule } from '../mpesa/mpesa.module';
import { ReputationModule } from '../reputation/reputation.module';
import { ActivityModule } from '../activity/activity.module';
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
import { RotationController } from './rotation.controller';
import { PayoutController } from './payout.controller';
import { ChamaMetricsController } from './chama-metrics.controller';

@Module({
  imports: [
    DatabaseModule,
    LedgerModule,
    WalletModule,
    MpesaModule,
    ReputationModule,
    ActivityModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    ChamaController,
    RotationController,
    PayoutController,
    ChamaMetricsController,
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
