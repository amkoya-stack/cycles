import { IsIn, IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @IsString()
  destination: string; // phone or email

  @IsString()
  code: string;

  @IsIn([
    'phone_verification',
    'email_verification',
    'password_reset',
    'two_factor',
  ])
  purpose:
    | 'phone_verification'
    | 'email_verification'
    | 'password_reset'
    | 'two_factor';
}
