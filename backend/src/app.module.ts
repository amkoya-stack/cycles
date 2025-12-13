import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './cache/redis.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { ChamaModule } from './chama/chama.module';
import { LedgerModule } from './ledger/ledger.module';
import { MpesaModule } from './mpesa/mpesa.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
