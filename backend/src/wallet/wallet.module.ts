import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MpesaModule } from '../mpesa/mpesa.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { StatementService } from './statement.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [DatabaseModule, LedgerModule, MpesaModule],
  controllers: [WalletController],
  providers: [WalletService, StatementService, NotificationService],
  exports: [WalletService],
})
export class WalletModule {}
