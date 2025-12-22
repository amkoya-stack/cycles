import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export enum ContributionType {
  FIXED = 'fixed',
  FLEXIBLE = 'flexible',
  INCOME_BASED = 'income_based',
}

export enum PaymentMethod {
  WALLET = 'wallet',
  MPESA_DIRECT = 'mpesa_direct',
  AUTO_DEBIT = 'auto_debit',
}

export class CreateContributionDto {
  @IsNotEmpty()
  @IsUUID()
  chamaId: string;

  @IsNotEmpty()
  @IsUUID()
  cycleId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  mpesaPhone?: string; // Required if paymentMethod is MPESA_DIRECT

  @IsOptional()
  @IsString()
  externalReference?: string; // For idempotency

  @IsOptional()
  @IsString()
  notes?: string; // Optional notes from user

  @IsOptional()
  @IsString()
  comment?: string;
}

export class GetContributionHistoryDto {
  @IsOptional()
  @IsUUID()
  chamaId?: string;

  @IsOptional()
  @IsString()
  status?: string; // 'pending', 'completed', 'failed'

  @IsOptional()
  @IsString()
  dateFrom?: string; // ISO date string

  @IsOptional()
  @IsString()
  dateTo?: string; // ISO date string

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  search?: string; // Search in reference or notes

  @IsOptional()
  @IsString()
  comment?: string;
}

// Alias for backward compatibility
export class ContributionHistoryQueryDto extends GetContributionHistoryDto {}

export class CreatePenaltyWaiverDto {
  @IsNotEmpty()
  @IsUUID()
  penaltyId: string;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class VotePenaltyWaiverDto {
  @IsNotEmpty()
  @IsUUID()
  waiverRequestId: string;

  @IsNotEmpty()
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsBoolean()
  vote?: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SetupAutoDebitDto {
  @IsNotEmpty()
  @IsUUID()
  chamaId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  mpesaPhone?: string; // Required if paymentMethod is MPESA_DIRECT

  @IsNotEmpty()
  @IsEnum(['fixed', 'cycle_amount'])
  amountType: 'fixed' | 'cycle_amount';

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  fixedAmount?: number; // Required if amountType is 'fixed'

  @IsNotEmpty()
  @IsEnum(['daily', '2-day', '3-day', 'weekly', 'biweekly', 'monthly'])
  frequencyType:
    | 'daily'
    | '2-day'
    | '3-day'
    | 'weekly'
    | 'biweekly'
    | 'monthly';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  autoDebitDay?: number; // Day of month for monthly/biweekly

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number; // Day of week for weekly/biweekly (0=Sunday, 6=Saturday)

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  intervalDays?: number; // Interval for daily frequencies

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

export class UpdateAutoDebitDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  mpesaPhone?: string;

  @IsOptional()
  @IsEnum(['fixed', 'cycle_amount'])
  amountType?: 'fixed' | 'cycle_amount';

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  fixedAmount?: number;

  @IsOptional()
  @IsEnum(['daily', '2-day', '3-day', 'weekly', 'biweekly', 'monthly'])
  frequencyType?:
    | 'daily'
    | '2-day'
    | '3-day'
    | 'weekly'
    | 'biweekly'
    | 'monthly';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  autoDebitDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  intervalDays?: number;
}
