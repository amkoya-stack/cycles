import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SecurityController } from './security.controller';
import { TransactionPinService } from './transaction-pin.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { WithdrawalLimitsService } from './withdrawal-limits.service';
import { IpWhitelistService } from './ip-whitelist.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [DatabaseModule, AdminModule],
  controllers: [SecurityController],
  providers: [
    TransactionPinService,
    DeviceFingerprintService,
    WithdrawalLimitsService,
    IpWhitelistService,
  ],
  exports: [
    TransactionPinService,
    DeviceFingerprintService,
    WithdrawalLimitsService,
    IpWhitelistService,
  ],
})
export class SecurityModule {}

