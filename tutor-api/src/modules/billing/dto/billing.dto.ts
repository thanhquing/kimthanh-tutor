import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutDto {
  @IsIn(['single_unlock', 'parent_vip', 'parent_tracking', 'tutor_qr'])
  product_type!: 'single_unlock' | 'parent_vip' | 'parent_tracking' | 'tutor_qr';

  // single_unlock: tutor_profile_id; parent_tracking: student_id.
  // parent_vip/tutor_qr: bỏ trống.
  @IsOptional()
  @IsString()
  @MaxLength(26)
  target_ref_id?: string;

  // Fallback cho client chưa gửi header Idempotency-Key. Controller ưu tiên header.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  idempotency_key?: string;
}

export class SepayWebhookDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() transaction_id?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() transfer_content?: string;
  @IsOptional() amount?: string | number;
  @IsOptional() transferAmount?: string | number;
  @IsOptional() transfer_amount?: string | number;
}
