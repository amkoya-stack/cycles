import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  Min,
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

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.WALLET;

  @IsOptional()
  @IsString()
  mpesaPhone?: string; // For direct M-Pesa payments

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ContributionHistoryQueryDto {
  @IsOptional()
  @IsUUID()
  chamaId?: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class CycleContributionSummaryDto {
  @IsNotEmpty()
  @IsUUID()
  cycleId: string;
}

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
  @IsEnum(['approve', 'reject'])
  vote: 'approve' | 'reject';

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
  @IsNumber()
  @Min(1)
  autoDebitDay: number; // Day of the cycle period (1-31)

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
  @IsNumber()
  @Min(1)
  autoDebitDay?: number;
}
