import { Type } from "class-transformer";
import {
  IsIn,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/pagination.dto";

export class AdminPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["pending", "paid", "failed", "cancelled", "refunded"])
  status?: "pending" | "paid" | "failed" | "cancelled" | "refunded";

  @IsOptional()
  @IsIn(["single_unlock", "parent_vip", "parent_tracking", "tutor_qr"])
  product_type?:
    "single_unlock" | "parent_vip" | "parent_tracking" | "tutor_qr";

  @IsOptional()
  @IsString()
  @MaxLength(26)
  payer_user_id?: string;
}

export class AdminAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(26)
  actor_user_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entity_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  entity_id?: string;
}

export class AdminOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["parent", "tutor", "admin"])
  role?: "parent" | "tutor" | "admin";

  @IsOptional()
  @IsIn(["pending_consent", "active", "suspended", "deleted"])
  status?: "pending_consent" | "active" | "suspended" | "deleted";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;
}

export class AdminUserStatusDto {
  @IsIn(["active", "suspended"])
  status!: "active" | "suspended";

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AdminSystemLogsQueryDto extends PaginationQueryDto {
  @IsIn(["audit", "webhook", "outbox"])
  type!: "audit" | "webhook" | "outbox";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  actor_user_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entity_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entity_id?: string;
}

export class PlatformPaymentAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bank_code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  account_number!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  account_holder!: string;

  @IsBoolean()
  is_active!: boolean;
}

export class PricingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  period_days?: number;

  @IsBoolean()
  is_enabled!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class PaidFeatureOverrideDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class TutorStatusDto {
  @IsIn(["published", "hidden", "suspended"])
  status!: "published" | "hidden" | "suspended";
}

export class ModerateReviewDto {
  @IsIn(["publish", "hide"])
  action!: "publish" | "hide";
}

export class ModerateMediaDto {
  @IsIn(["approve", "reject"])
  action!: "approve" | "reject";

  @IsOptional()
  @IsIn(["pending", "clean", "infected"])
  scan_status?: "pending" | "clean" | "infected";
}

export class RefundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  payment_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;
}
