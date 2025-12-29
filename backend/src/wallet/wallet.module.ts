import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MpesaModule } from '../mpesa/mpesa.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { StatementService } from './statement.service';
import { NotificationService } from './notification.service';
import { MpesaReconciliationService } from './mpesa-reconciliation.service';
import { WalletGateway } from './wallet.gateway';
import { LimitsService } from './limits.service';
import { FinancialTransactionProcessor } from './queues/financial-transaction.processor';

@Module({
  imports: [
    DatabaseModule,
    LedgerModule,
    forwardRef(() => MpesaModule),
    BullModule.registerQueue({
      name: 'financial-transactions',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    }),
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    StatementService,
    NotificationService,
    MpesaReconciliationService,
    WalletGateway,
    LimitsService,
    FinancialTransactionProcessor,
  ],
  exports: [
    WalletService,
    NotificationService,
    MpesaReconciliationService,
    WalletGateway,
    LimitsService,
    BullModule,
  ],
})
export class WalletModule {}
