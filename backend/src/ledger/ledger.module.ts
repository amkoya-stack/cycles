import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationProcessor } from './reconciliation.processor';
import { ReconciliationController } from './reconciliation.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'reconciliation',
    }),
  ],
  controllers: [LedgerController, ReconciliationController],
  providers: [LedgerService, ReconciliationService, ReconciliationProcessor],
  exports: [LedgerService, ReconciliationService],
})
export class LedgerModule {}
