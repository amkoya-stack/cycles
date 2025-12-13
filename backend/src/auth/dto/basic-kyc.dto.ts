import { IsDateString, IsString } from 'class-validator';

export class BasicKycDto {
  @IsString()
  idNumber: string;

  @IsString()
  fullName: string;

  @IsDateString()
  dob: string; // ISO date
}
