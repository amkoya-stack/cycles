import { IsNumber, IsOptional, IsString, Min, IsUUID } from 'class-validator';

export class WithdrawalDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  destinationAccount: string; // M-Pesa number or bank account

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  withdrawalMethod?: string; // 'mpesa', 'bank'

  // Temporary until auth middleware populates req.user
  @IsOptional()
  @IsUUID()
  userId?: string;
}
