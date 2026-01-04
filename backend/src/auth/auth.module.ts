import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../cache/redis.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CommonModule } from '../common/common.module';
import { RateLimitMiddleware } from './rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DatabaseModule,
    UsersModule,
    RedisModule,
    LedgerModule,
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, RateLimitMiddleware],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('auth/otp/send', 'auth/otp/verify');
  }
}
