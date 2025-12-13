import { IsString } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  ownerId: string; // userId or chamaId

  @IsString()
  ownerType: 'user' | 'chama';

  @IsString()
  ownerName: string;
}
