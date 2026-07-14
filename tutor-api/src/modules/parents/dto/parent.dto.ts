import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertParentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class StudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  // Khớp cột Student.grade (String, bắt buộc) — vd "5", "Lớp 9", "12".
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  grade!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  learning_goals?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  learning_goals?: string;
}
