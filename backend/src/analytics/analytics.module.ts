import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AdminModule } from '../admin/admin.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [DatabaseModule, AdminModule, CommonModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

