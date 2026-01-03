import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { GovernanceModule } from '../governance/governance.module';
import { WalletModule } from '../wallet/wallet.module';
import { InvestmentController } from './investment.controller';
import { InvestmentService } from './investment.service';
import { InvestmentAutomationService } from './investment-automation.service';
import { ExternalInvestmentController } from './external-investment.controller';
import { ExternalInvestmentService } from './external-investment.service';
import { ExternalInvestmentAutomationService } from './external-investment-automation.service';
import { InvestmentExecutionProcessor } from './queues/investment-execution.processor';

@Module({
  imports: [
    DatabaseModule,
    LedgerModule,
    GovernanceModule,
    WalletModule,
    ScheduleModule,
    BullModule.registerQueue({
      name: 'investment-executions',
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
  controllers: [InvestmentController, ExternalInvestmentController],
  providers: [
    InvestmentService,
    InvestmentAutomationService,
    ExternalInvestmentService,
    ExternalInvestmentAutomationService,
    InvestmentExecutionProcessor,
  ],
  exports: [InvestmentService, ExternalInvestmentService, BullModule],
})
export class InvestmentModule {}

