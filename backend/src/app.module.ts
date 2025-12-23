import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './cache/redis.module';
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
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
