import { IsString } from 'class-validator';

export class NextOfKinDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  relationship: string;
}
