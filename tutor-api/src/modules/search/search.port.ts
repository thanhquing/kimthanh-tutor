import { SearchQueryDto } from './dto/search-query.dto';
import { KeysetResult } from '../../common/pagination/keyset';

// Thẻ gia sư trả về cho chợ (shape công khai, snake_case).
export interface TutorCard {
  id: string;
  display_name: string;
  avatar_media_id: string | null;
  region: string | null;
  education_level: string | null;
  school_name: string | null;
  subjects: string[];
  grade_levels: number[];
  teaching_modes: string[];
  fee_min: number | null;
  fee_max: number | null;
  rating_avg: number;
  rating_count: number;
  bio_snippet: string | null;
}

// Ranh giới đọc chợ gia sư (ai-docs/15 §2). Controller phụ thuộc abstraction này,
// KHÔNG phụ thuộc engine cụ thể. Adapter mặc định: Postgres (lọc bảng chuẩn hóa
// đã index). Khi chạm ngưỡng (>~50k hồ sơ hoặc p95 > 200ms) chỉ cần bind
// useClass sang adapter Meilisearch/OpenSearch, không sửa controller/nghiệp vụ.
export abstract class SearchPort {
  abstract search(q: SearchQueryDto): Promise<KeysetResult<TutorCard>>;
}
