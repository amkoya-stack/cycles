import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../cache/redis.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [DatabaseModule, RedisModule, ActivityModule],
  providers: [DocumentService],
  controllers: [DocumentController],
  exports: [DocumentService],
})
export class DocumentModule {}
