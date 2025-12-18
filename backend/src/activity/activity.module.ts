import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { NotificationService } from './notification.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivityController],
  providers: [ActivityService, NotificationService],
  exports: [ActivityService, NotificationService],
})
export class ActivityModule {}
