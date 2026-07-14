import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class QrRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(26)
  class_contract_id?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  payout_account_id!: string;
}

export class QrListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(26)
  class_contract_id?: string;
}
