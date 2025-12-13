import { IsNumber, IsString, IsOptional, Min, IsUUID } from 'class-validator';

export class DepositDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  externalReference: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string; // 'mpesa', 'bank', 'card'

  // Temporary until auth middleware populates req.user
  @IsOptional()
  @IsUUID()
  userId?: string;
}
