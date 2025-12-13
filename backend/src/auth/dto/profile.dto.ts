import { IsOptional, IsString } from 'class-validator';

export class ProfileDto {
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}
