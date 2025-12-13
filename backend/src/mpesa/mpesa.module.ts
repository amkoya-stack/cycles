import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
