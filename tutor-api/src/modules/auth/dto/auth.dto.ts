import { IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsIn(['sms', 'email'])
  channel!: 'sms' | 'email';

  @IsString()
  @IsNotEmpty()
  destination!: string; // SĐT hoặc email
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  request_id!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

export class GoogleOAuthDto {
  @IsString()
  @IsNotEmpty()
  id_token!: string;
}

export class FacebookOAuthDto {
  @IsString()
  @IsNotEmpty()
  access_token!: string;
}
