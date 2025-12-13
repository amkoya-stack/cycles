import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { ChamaController } from './chama.controller';
import { ChamaService } from './chama.service';

@Module({
  imports: [DatabaseModule, LedgerModule, WalletModule],
  controllers: [ChamaController],
  providers: [ChamaService],
  exports: [ChamaService],
})
export class ChamaModule {}
