import { Module } from '@nestjs/common';
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

@Module({
  imports: [DatabaseModule, LedgerModule, MpesaModule],
  controllers: [WalletController],
  providers: [
    WalletService,
    StatementService,
    NotificationService,
    MpesaReconciliationService,
    WalletGateway,
    LimitsService,
  ],
  exports: [
    WalletService,
    NotificationService,
    MpesaReconciliationService,
    WalletGateway,
    LimitsService,
  ],
})
export class WalletModule {}
