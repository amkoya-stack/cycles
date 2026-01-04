import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrailInterceptor } from './audit-trail.interceptor';

@Module({
  imports: [DatabaseModule],
  providers: [AuditTrailService, AuditTrailInterceptor],
  exports: [AuditTrailService, AuditTrailInterceptor],
})
export class AuditModule {}

