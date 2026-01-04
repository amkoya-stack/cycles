import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryService } from './sentry.service';
import { DataDogService } from './datadog.service';

@Module({
  imports: [ConfigModule],
  providers: [SentryService, DataDogService],
  exports: [SentryService, DataDogService],
})
export class MonitoringModule {}

