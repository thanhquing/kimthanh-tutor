import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class OfflineAreaDto {
  @IsString()
  @IsNotEmpty()
  province_code!: string;

  @IsOptional()
  @IsString()
  district_code?: string;
}

// Upsert hồ sơ gia sư. display_name bắt buộc khi tạo; các trường khác optional.
// Mảng chuẩn hóa (subjects/grade_levels/...) nếu truyền sẽ thay thế toàn bộ.
export class TutorProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  display_name!: string;

  @IsOptional() @IsString() @MaxLength(4000) bio?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(80) voice_accent?: string;
  @IsOptional() @IsIn(["male", "female", "other"]) gender?: string;
  @IsOptional() @IsString() @MaxLength(80) education_level?: string;
  @IsOptional() @IsString() @MaxLength(160) school_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  student_year?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30)
  exam_score?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10) gpa?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) expected_fee_min?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) expected_fee_max?: number;

  @IsOptional() @IsString() avatar_media_id?: string;
  @IsOptional() @IsString() intro_video_media_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  subjects?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsArray()
  @ArrayMaxSize(15)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  grade_levels?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(["online", "offline"], { each: true })
  teaching_modes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OfflineAreaDto)
  offline_areas?: OfflineAreaDto[];
}

export class UpdateTutorProfileDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) display_name?: string;
  @IsOptional() @IsString() @MaxLength(4000) bio?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(80) voice_accent?: string;
  @IsOptional() @IsIn(["male", "female", "other"]) gender?: string;
  @IsOptional() @IsString() @MaxLength(80) education_level?: string;
  @IsOptional() @IsString() @MaxLength(160) school_name?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  student_year?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30)
  exam_score?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10) gpa?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) expected_fee_min?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) expected_fee_max?: number;
  @IsOptional() @IsString() avatar_media_id?: string;
  @IsOptional() @IsString() intro_video_media_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  subjects?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsArray()
  @ArrayMaxSize(15)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  grade_levels?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(["online", "offline"], { each: true })
  teaching_modes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OfflineAreaDto)
  offline_areas?: OfflineAreaDto[];
}

export class AvailabilityDto {
  @IsInt() @Min(0) @Max(6) day_of_week!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start_time!: string; // HH:mm

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end_time!: string;

  @IsOptional() @IsIn(["busy", "available"]) type?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class PayoutAccountDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @IsNotEmpty() @Matches(/^\d{6}$/) bank_code!: string;

  @Transform(({ value }) => typeof value === "string" ? value.replace(/[\s-]/g, "") : value)
  @IsString() @Matches(/^\d{6,19}$/) account_number!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value)
  @IsString() @IsNotEmpty() @MaxLength(120) @Matches(/^[\p{L}][\p{L}\p{M}\s.'-]*$/u) account_holder!: string;
  @IsOptional() @IsBoolean() is_default?: boolean;
}

export class MediaUploadDto {
  @IsIn(["avatar", "intro_video", "other"])
  kind!: string;

  @IsString()
  @IsNotEmpty()
  content_type!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number;
}
