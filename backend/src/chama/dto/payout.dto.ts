import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SchedulePayoutDto {
  @IsUUID()
  cycleId: string;

  @IsUUID()
  recipientId: string; // member_id

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsEnum(['wallet', 'mpesa_direct', 'bank_transfer'])
  payoutMethod?: 'wallet' | 'mpesa_direct' | 'bank_transfer';
}

export class ExecutePayoutDto {
  @IsUUID()
  payoutId: string;
}

export class CancelPayoutDto {
  @IsUUID()
  payoutId: string;

  @IsOptional()
  reason?: string;
}

export class RetryPayoutDto {
  @IsUUID()
  payoutId: string;
}

export class GetPayoutHistoryDto {
  @IsOptional()
  @IsUUID()
  chamaId?: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed', 'failed', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
