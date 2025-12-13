import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  destination: string; // phone or email

  @IsString()
  otp: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
