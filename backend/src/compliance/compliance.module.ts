import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ComplianceController } from './compliance.controller';
import { RegulatoryReportsService } from './regulatory-reports.service';
import { GdprModule } from '../gdpr/gdpr.module';
import { AuditModule } from '../audit/audit.module';
import { AmlModule } from '../aml/aml.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [DatabaseModule, AmlModule, AdminModule, GdprModule, AuditModule],
  controllers: [ComplianceController],
  providers: [RegulatoryReportsService],
  exports: [RegulatoryReportsService],
})
export class ComplianceModule {}

