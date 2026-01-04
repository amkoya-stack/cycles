import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AmlController } from './aml.controller';
import { AmlMonitoringService } from './aml-monitoring.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [DatabaseModule, AdminModule],
  controllers: [AmlController],
  providers: [AmlMonitoringService],
  exports: [AmlMonitoringService],
})
export class AmlModule {}

