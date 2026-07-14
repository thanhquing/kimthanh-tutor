import { Type } from "class-transformer";
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/pagination.dto";

export class TransitionDto {
  @IsIn([
    "active",
    "paused",
    "completed_pending_review",
    "completed",
    "cancelled",
  ])
  to!:
    | "active"
    | "paused"
    | "completed_pending_review"
    | "completed"
    | "cancelled";
}

export class LessonLogDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lesson_at?: Date;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  homework?: string;

  @IsIn(["good", "normal", "needs_review"])
  absorption_level!: "good" | "normal" | "needs_review";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tutor_note?: string;
}

export class UpdateLessonLogDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lesson_at?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  homework?: string;

  @IsOptional()
  @IsIn(["good", "normal", "needs_review"])
  absorption_level?: "good" | "normal" | "needs_review";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tutor_note?: string;
}

export class LessonLogsQueryDto extends PaginationQueryDto {}
