import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReputationModule } from '../reputation/reputation.module';
import { LendingService } from './lending.service';
import { LendingController } from './lending.controller';
import { ExternalLendingService } from './external-lending.service';
import { ExternalLendingController } from './external-lending.controller';
import { InterChamaLendingService } from './inter-chama-lending.service';
import { InterChamaLendingController } from './inter-chama-lending.controller';

@Module({
  imports: [DatabaseModule, LedgerModule, ReputationModule],
  controllers: [
    LendingController,
    ExternalLendingController,
    InterChamaLendingController,
  ],
  providers: [
    LendingService,
    ExternalLendingService,
    InterChamaLendingService,
  ],
  exports: [
    LendingService,
    ExternalLendingService,
    InterChamaLendingService,
  ],
})
export class LendingModule {}

