import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ConfigModule, DatabaseModule, forwardRef(() => WalletModule)],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
