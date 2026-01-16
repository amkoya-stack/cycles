// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './cache/redis.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { ChamaModule } from './chama/chama.module';
import { LedgerModule } from './ledger/ledger.module';
import { MpesaModule } from './mpesa/mpesa.module';
import { AdminModule } from './admin/admin.module';
import { ReputationModule } from './reputation/reputation.module';
import { ActivityModule } from './activity/activity.module';
import { GovernanceModule } from './governance/governance.module';
import { ChatModule } from './chat/chat.module';
import { DocumentModule } from './document/document.module';
import { MeetingsModule } from './meetings/meetings.module';
import { LendingModule } from './lending/lending.module';
import { InvestmentModule } from './investment/investment.module';
import { DisputeModule } from './dispute/dispute.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { KycModule } from './kyc/kyc.module';
import { SecurityModule } from './security/security.module';
import { AmlModule } from './aml/aml.module';
import { GdprModule } from './gdpr/gdpr.module';
import { AuditModule } from './audit/audit.module';
import { ComplianceModule } from './compliance/compliance.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { HealthModule } from './health/health.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditTrailInterceptor } from './audit/audit-trail.interceptor';
import { MonitoringInterceptor } from './monitoring/monitoring.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    DatabaseModule,
    RedisModule,
    CommonModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WalletModule,
    LedgerModule,
    MpesaModule,
    ChamaModule,
    AdminModule,
    ReputationModule,
    ActivityModule,
    GovernanceModule,
    ChatModule,
    DocumentModule,
    MeetingsModule,
    LendingModule,
    InvestmentModule,
    DisputeModule,
    AnalyticsModule,
    KycModule,
    SecurityModule,
    AmlModule,
    GdprModule,
    AuditModule,
    ComplianceModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditTrailInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule {}
