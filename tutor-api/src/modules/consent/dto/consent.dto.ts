import { IsBoolean, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RecordConsentDto {
  @IsString()
  @IsNotEmpty()
  terms_document_id!: string;

  @IsString()
  @IsNotEmpty()
  privacy_document_id!: string;

  @IsBoolean()
  scroll_reached_bottom!: boolean;

  @IsIn(['scroll_and_click', 'reaccept'])
  consent_method!: string;
}
