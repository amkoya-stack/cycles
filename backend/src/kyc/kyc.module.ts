import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { DisputeModule } from '../dispute/dispute.module'; // For FileUploadService

@Module({
  imports: [DatabaseModule, DisputeModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}

