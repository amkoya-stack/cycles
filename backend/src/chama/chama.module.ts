import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { MpesaModule } from '../mpesa/mpesa.module';
import { ChamaController } from './chama.controller';
import { ChamaService } from './chama.service';
import { ContributionService } from './contribution.service';
import { ReminderService } from './reminder.service';
import { AutoDebitService } from './auto-debit.service';

@Module({
  imports: [DatabaseModule, LedgerModule, WalletModule, MpesaModule],
  controllers: [ChamaController],
  providers: [
    ChamaService,
    ContributionService,
    ReminderService,
    AutoDebitService,
  ],
  exports: [ChamaService],
})
export class ChamaModule {}
