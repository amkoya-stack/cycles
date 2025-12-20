import {
  IsString,
  IsUUID,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class CreateReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsUUID()
  parentReplyId?: string;
}

export class UpdatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class UpdateReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
