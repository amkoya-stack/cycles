import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WalletModule } from '../wallet/wallet.module';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { DisputeAdminController } from './dispute-admin.controller';
import { FileUploadService } from './file-upload.service';
import { DisputeNotificationService } from './dispute-notification.service';
import { DisputeReminderService } from './dispute-reminder.service';

@Module({
  imports: [DatabaseModule, WalletModule],
  controllers: [DisputeController, DisputeAdminController],
  providers: [
    DisputeService,
    FileUploadService,
    DisputeNotificationService,
    DisputeReminderService,
  ],
  exports: [DisputeService, FileUploadService],
})
export class DisputeModule {}

