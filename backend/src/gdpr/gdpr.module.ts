import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { DataRetentionService } from './data-retention.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [DatabaseModule, CommonModule, AdminModule],
  controllers: [GdprController],
  providers: [GdprService, DataRetentionService],
  exports: [GdprService, DataRetentionService],
})
export class GdprModule {}

