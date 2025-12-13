import { IsIn, IsString } from 'class-validator';

export class SendOtpDto {
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @IsString()
  destination: string; // phone or email

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
