import { IsNumber, IsString, Min, IsUUID, IsOptional } from 'class-validator';

export class ContributionDto {
  @IsUUID()
  chamaId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  description: string;

  // Temporary until auth middleware populates req.user
  @IsOptional()
  @IsUUID()
  userId?: string;
}
