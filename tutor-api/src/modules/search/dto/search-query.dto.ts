import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/pagination.dto";

// Số được coerce + validate tại DTO (global ValidationPipe transform:true), nên
// giá trị sai (vd fee_min=abc) → 400 VALIDATION_ERROR, không còn BigInt(NaN)→500.
export class SearchQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() subject?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade_level?: number;
  @IsOptional() @IsIn(["online", "offline"]) teaching_mode?: string;
  @IsOptional() @IsIn(["male", "female", "other"]) gender?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() voice_accent?: string;
  @IsOptional() @IsString() education_level?: string;
  @IsOptional() @IsString() school_name?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30)
  min_exam_score?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  min_gpa?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) fee_min?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) fee_max?: number;
  @IsOptional() @IsString() province_code?: string;
  @IsOptional() @IsString() district_code?: string;

  @IsOptional()
  @IsIn(["rating", "newest", "fee_asc"])
  sort?: "rating" | "newest" | "fee_asc";
}
