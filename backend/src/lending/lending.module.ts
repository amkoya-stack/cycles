import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReputationModule } from '../reputation/reputation.module';
import { WalletModule } from '../wallet/wallet.module';
import { CommonModule } from '../common/common.module';
import { LendingService } from './lending.service';
import { LendingController } from './lending.controller';
import { ExternalLendingService } from './external-lending.service';
import { ExternalLendingController } from './external-lending.controller';
import { InterChamaLendingService } from './inter-chama-lending.service';
import { InterChamaLendingController } from './inter-chama-lending.controller';
import { LoanReminderService } from './loan-reminder.service';

@Module({
  imports: [DatabaseModule, CommonModule, LedgerModule, ReputationModule, WalletModule],
  controllers: [
    LendingController,
    ExternalLendingController,
    InterChamaLendingController,
  ],
  providers: [
    LendingService,
    ExternalLendingService,
    InterChamaLendingService,
    LoanReminderService,
  ],
  exports: [
    LendingService,
    ExternalLendingService,
    InterChamaLendingService,
    LoanReminderService,
  ],
})
export class LendingModule {}

