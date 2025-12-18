import {
  IsUUID,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateRotationOrderDto {
  @IsUUID()
  chamaId: string;

  @IsEnum(['sequential', 'random', 'merit_based', 'custom'])
  rotationType: 'sequential' | 'random' | 'merit_based' | 'custom';

  @IsInt()
  @Min(1)
  @Max(12)
  cycleDurationMonths: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  customOrder?: string[]; // Array of member IDs for custom rotation
}

export class SkipRotationPositionDto {
  @IsUUID()
  positionId: string;

  @IsOptional()
  reason?: string;
}

export class SwapRotationPositionsDto {
  @IsUUID()
  position1Id: string;

  @IsUUID()
  position2Id: string;

  @IsOptional()
  reason?: string;
}
