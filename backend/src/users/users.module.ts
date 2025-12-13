import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { LedgerModule } from '../ledger/ledger.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [LedgerModule, DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
