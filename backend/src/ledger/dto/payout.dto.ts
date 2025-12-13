import { IsNumber, IsString, Min } from 'class-validator';

export class PayoutDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  description: string;
}
