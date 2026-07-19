import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';

export class CreateTrialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  tutor_profile_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  student_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  learning_goal?: string;

  @IsOptional()
  @IsIn(['online', 'offline'])
  teaching_mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  preferred_schedule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  // Bắt buộc cho guest; bỏ qua với parent đăng nhập.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  contact_email?: string;
}

export class DeclineTrialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expected_version?: number;
}

export class TrialActionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  expected_version?: number;
}

export class TrialMineQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['parent', 'tutor'])
  role?: 'parent' | 'tutor';

  @IsOptional()
  @IsIn(['pending', 'accepted', 'declined', 'expired', 'cancelled'])
  status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
}

export class ActivationDto {
  @IsString()
  @IsNotEmpty()
  activation_token!: string;
}
