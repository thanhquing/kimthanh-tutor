import { IsOptional, IsString, MaxLength } from 'class-validator';

// Query keyset dùng chung cho mọi danh sách lớn (search, notifications,
// dashboard...). `limit` để dạng string, chuẩn hóa bằng clampLimit ở service.
export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  limit?: string;
}
