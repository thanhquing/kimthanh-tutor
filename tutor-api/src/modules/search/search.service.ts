import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  buildKeyset,
  clampLimit,
  decodeCursor,
  encodeCursor,
  KeysetResult,
} from '../../common/pagination/keyset';

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

// select tối thiểu cho thẻ search (không over-fetch cột không dùng trên hot-path).
const cardSelect = {
  id: true,
  displayName: true,
  avatarMediaId: true,
  region: true,
  educationLevel: true,
  schoolName: true,
  bio: true,
  expectedFeeMin: true,
  expectedFeeMax: true,
  ratingAvg: true,
  ratingCount: true,
  publishedAt: true,
  subjects: { select: { subjectCode: true } },
  gradeLevels: { select: { gradeLevel: true } },
  teachingModes: { select: { mode: true } },
} satisfies Prisma.TutorProfileSelect;

type Row = Prisma.TutorProfileGetPayload<{ select: typeof cardSelect }>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /tutors/search — hot-path công khai. Lọc bảng chuẩn hóa (index),
  // rating denormalized, keyset pagination (12-non-functional-requirements).
  async search(q: SearchQueryDto): Promise<KeysetResult<TutorCard>> {
    if (
      q.fee_min !== undefined &&
      q.fee_max !== undefined &&
      q.fee_min > q.fee_max
    ) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'fee_min phải nhỏ hơn hoặc bằng fee_max',
        { fee_min: q.fee_min, fee_max: q.fee_max },
      );
    }

    const limit = clampLimit(q.limit);
    const sort = q.sort ?? 'rating';

    const where: Prisma.TutorProfileWhereInput = {
      status: 'published',
      deletedAt: null,
    };

    if (q.subject) where.subjects = { some: { subjectCode: q.subject } };
    if (q.grade_level !== undefined)
      where.gradeLevels = { some: { gradeLevel: q.grade_level } };
    if (q.teaching_mode)
      where.teachingModes = { some: { mode: q.teaching_mode } };
    if (q.province_code) {
      where.offlineAreas = {
        some: {
          provinceCode: q.province_code,
          ...(q.district_code ? { districtCode: q.district_code } : {}),
        },
      };
    }
    if (q.gender) where.gender = q.gender;
    if (q.region) where.region = q.region;
    if (q.voice_accent) where.voiceAccent = q.voice_accent;
    if (q.education_level) where.educationLevel = q.education_level;
    if (q.school_name)
      where.schoolName = { contains: q.school_name, mode: 'insensitive' };

    if (q.min_exam_score !== undefined)
      where.examScore = { gte: q.min_exam_score };
    if (q.min_gpa !== undefined) where.gpa = { gte: q.min_gpa };
    if (q.fee_max !== undefined)
      where.expectedFeeMin = { lte: BigInt(q.fee_max) };
    if (q.fee_min !== undefined)
      where.expectedFeeMax = { gte: BigInt(q.fee_min) };

    const orderBy = this.orderBy(sort);
    this.applyCursor(where, sort, q.cursor);

    const rows = await this.prisma.tutorProfile.findMany({
      where,
      orderBy,
      take: limit + 1,
      select: cardSelect,
    });

    // Phân trang trên hàng gốc rồi mới map (bỏ reverse-lookup O(n^2) + non-null!).
    const page = buildKeyset(rows, limit, (r) => this.cursorFor(sort, r));
    return {
      items: page.items.map((r) => this.toCard(r)),
      next_cursor: page.next_cursor,
    };
  }

  private orderBy(
    sort: string,
  ): Prisma.TutorProfileOrderByWithRelationInput[] {
    switch (sort) {
      case 'newest':
        return [{ publishedAt: 'desc' }, { id: 'desc' }];
      case 'fee_asc':
        return [{ expectedFeeMin: 'asc' }, { id: 'asc' }];
      case 'rating':
      default:
        return [{ ratingAvg: 'desc' }, { id: 'desc' }];
    }
  }

  private applyCursor(
    where: Prisma.TutorProfileWhereInput,
    sort: string,
    cursor?: string,
  ): void {
    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    if (!decoded) return;
    const [value, id] = decoded;

    if (sort === 'newest') {
      if (typeof value !== 'string') {
        throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
      }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
      }
      where.OR = [{ publishedAt: { lt: d } }, { publishedAt: d, id: { lt: id } }];
    } else if (sort === 'fee_asc') {
      // Thứ tự: các fee số (asc) trước, nhóm fee null sau cùng (NULLS LAST).
      if (value === null) {
        // Đang ở nhóm null → chỉ lấy null có id lớn hơn (không quay lại vùng số).
        where.expectedFeeMin = null;
        where.id = { gt: id };
      } else {
        if (typeof value !== 'number') {
          throw new AppException(
            ErrorCode.VALIDATION_ERROR,
            'Cursor không hợp lệ',
          );
        }
        const v = BigInt(value);
        where.OR = [
          { expectedFeeMin: { gt: v } },
          { expectedFeeMin: v, id: { gt: id } },
          { expectedFeeMin: null }, // nối tiếp sang nhóm null khi hết số
        ];
      }
    } else {
      if (typeof value !== 'number') {
        throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
      }
      where.OR = [
        { ratingAvg: { lt: value } },
        { ratingAvg: value, id: { lt: id } },
      ];
    }
  }

  private cursorFor(sort: string, row: Row): string {
    if (sort === 'newest') {
      return encodeCursor(
        (row.publishedAt ?? new Date(0)).toISOString(),
        row.id,
      );
    }
    if (sort === 'fee_asc') {
      return encodeCursor(
        row.expectedFeeMin === null ? null : Number(row.expectedFeeMin),
        row.id,
      );
    }
    return encodeCursor(row.ratingAvg, row.id);
  }

  private toCard(r: Row): TutorCard {
    return {
      id: r.id,
      display_name: r.displayName,
      avatar_media_id: r.avatarMediaId,
      region: r.region,
      education_level: r.educationLevel,
      school_name: r.schoolName,
      subjects: r.subjects.map((s) => s.subjectCode),
      grade_levels: r.gradeLevels.map((g) => g.gradeLevel),
      teaching_modes: r.teachingModes.map((t) => t.mode),
      fee_min: r.expectedFeeMin != null ? Number(r.expectedFeeMin) : null,
      fee_max: r.expectedFeeMax != null ? Number(r.expectedFeeMax) : null,
      rating_avg: r.ratingAvg,
      rating_count: r.ratingCount,
      bio_snippet: r.bio ? r.bio.slice(0, 160) : null,
    };
  }
}
