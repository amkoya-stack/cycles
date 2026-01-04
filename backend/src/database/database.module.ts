import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { RlsValidatorService } from './rls-validator.service';
import { RlsContextGuard } from './rls-context.guard';

@Global()
@Module({
  providers: [DatabaseService, RlsValidatorService, RlsContextGuard],
  exports: [DatabaseService, RlsValidatorService, RlsContextGuard],
})
export class DatabaseModule {}
