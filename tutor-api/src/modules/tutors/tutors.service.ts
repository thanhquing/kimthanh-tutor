import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { newId } from '../../common/utils/id.util';
import { Db } from '../../common/shared/db.type';
import { AccessService } from '../../common/shared/access.service';
import { MediaService } from '../../common/shared/media.service';
import { OutboxService } from '../../common/shared/outbox.service';
import { AuthUser } from '../../common/auth/auth-user';
import {
  AvailabilityDto,
  MediaUploadDto,
  PayoutAccountDto,
  TutorProfileDto,
  UpdateTutorProfileDto,
} from './dto/tutor.dto';

type ProfileInput = TutorProfileDto | UpdateTutorProfileDto;
type TutorScalarData = {
  displayName?: string;
  bio?: string;
  region?: string;
  voiceAccent?: string;
  gender?: string;
  educationLevel?: string;
  schoolName?: string;
  studentYear?: number;
  examScore?: number;
  gpa?: number;
  expectedFeeMin?: bigint;
  expectedFeeMax?: bigint;
  avatarMediaId?: string;
  introVideoMediaId?: string;
};

@Injectable()
export class TutorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly media: MediaService,
    private readonly outbox: OutboxService,
  ) {}

  // POST /tutors/me/profile — tạo (hoặc cập nhật) hồ sơ + cấp vai trò 'tutor'.
  async upsertProfile(user: AuthUser, dto: TutorProfileDto) {
    const existing = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true, expectedFeeMin: true, expectedFeeMax: true },
    });
    this.assertFeeRange(dto, existing);
    this.requiredTrim(dto.display_name, 'display_name');

    const id = existing?.id ?? newId();
    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.tutorProfile.update({
          where: { id },
          data: { ...this.scalarData(dto), version: { increment: 1 } },
        });
      } else {
        await tx.tutorProfile.create({
          data: {
            id,
            userId: user.userId,
            displayName: dto.display_name!,
            ...this.scalarData(dto),
          },
        });
        const u = await tx.user.findUnique({
          where: { id: user.userId },
          select: { roles: true },
        });
        if (u && !u.roles.includes('tutor')) {
          await tx.user.update({
            where: { id: user.userId },
            data: { roles: { set: [...u.roles, 'tutor'] } },
          });
        }
      }
      await this.syncNormalized(tx, id, dto);
    });

    return this.getOwnProfile(id);
  }

  // PATCH /tutors/me/profile — cập nhật một phần; đồng bộ bảng chuẩn hóa.
  async updateProfile(user: AuthUser, dto: UpdateTutorProfileDto) {
    const profile = await this.requireOwnProfile(user.userId);
    this.assertFeeRange(dto, profile);
    if (dto.display_name !== undefined) {
      this.requiredTrim(dto.display_name, 'display_name');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.tutorProfile.update({
        where: { id: profile.id },
        data: { ...this.scalarData(dto), version: { increment: 1 } },
      });
      await this.syncNormalized(tx, profile.id, dto);
      // Đổi dữ liệu search khi đã published → phát outbox để worker đồng bộ.
      if (profile.status === 'published') {
        await this.outbox.emit(tx, {
          aggregateType: 'tutor_profile',
          aggregateId: profile.id,
          eventType: 'tutor_profile.updated',
          payload: { tutor_profile_id: profile.id },
        });
      }
    });
    return this.getOwnProfile(profile.id);
  }

  // GET /tutors/me/profile — trả hồ sơ đầy đủ của chính gia sư cho màn hình quản lý.
  async getMyProfile(userId: string) {
    const profile = await this.requireOwnProfile(userId);
    return this.getOwnProfile(profile.id);
  }

  // POST /tutors/me/profile/publish — chỉ published khi đủ điều kiện publishable.
  async publish(userId: string) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      include: {
        _count: {
          select: { subjects: true, gradeLevels: true, teachingModes: true },
        },
      },
    });
    if (!profile) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Chưa có hồ sơ gia sư');
    }

    const missing: string[] = [];
    if (!profile.bio) missing.push('bio');
    if (profile.expectedFeeMin == null) missing.push('expected_fee_min');
    if (profile._count.subjects === 0) missing.push('subjects');
    if (profile._count.gradeLevels === 0) missing.push('grade_levels');
    if (profile._count.teachingModes === 0) missing.push('teaching_modes');
    if (missing.length > 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Hồ sơ chưa đủ điều kiện xuất bản',
        { missing },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tutorProfile.update({
        where: { id: profile.id },
        data: {
          status: 'published',
          publishedAt: profile.publishedAt ?? new Date(),
          version: { increment: 1 },
        },
      });
      await this.outbox.emit(tx, {
        aggregateType: 'tutor_profile',
        aggregateId: profile.id,
        eventType: 'tutor_profile.published',
        payload: { tutor_profile_id: profile.id },
      });
    });

    return { status: 'published' };
  }

  // ---- Availabilities ----
  async listAvailabilities(userId: string) {
    const profile = await this.requireOwnProfile(userId);
    const items = await this.prisma.tutorAvailability.findMany({
      where: { tutorProfileId: profile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return {
      items: items.map((a) => ({
        id: a.id,
        day_of_week: a.dayOfWeek,
        start_time: a.startTime,
        end_time: a.endTime,
        type: a.type,
        note: a.note,
      })),
    };
  }

  async addAvailability(userId: string, dto: AvailabilityDto) {
    const profile = await this.requireOwnProfile(userId);
    if (dto.start_time >= dto.end_time) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'start_time phải trước end_time',
      );
    }
    const a = await this.prisma.tutorAvailability.create({
      data: {
        id: newId(),
        tutorProfileId: profile.id,
        dayOfWeek: dto.day_of_week,
        startTime: dto.start_time,
        endTime: dto.end_time,
        type: dto.type ?? 'available',
        note: dto.note ?? null,
      },
    });
    return { id: a.id };
  }

  async removeAvailability(userId: string, id: string) {
    const profile = await this.requireOwnProfile(userId);
    const found = await this.prisma.tutorAvailability.findFirst({
      where: { id, tutorProfileId: profile.id },
      select: { id: true },
    });
    if (!found) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không tìm thấy lịch');
    }
    await this.prisma.tutorAvailability.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Payout accounts (PII) ----
  async listPayoutAccounts(userId: string) {
    const profile = await this.requireOwnProfile(userId);
    const items = await this.prisma.tutorPayoutAccount.findMany({
      where: { tutorProfileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: items.map((account) => ({
        id: account.id,
        bank_code: account.bankCode,
        account_number_masked: this.maskAccount(account.accountNumber),
        account_holder: account.accountHolder,
        is_default: account.isDefault,
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      })),
    };
  }

  async addPayoutAccount(userId: string, dto: PayoutAccountDto) {
    const profile = await this.requireOwnProfile(userId);
    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.tutorPayoutAccount.updateMany({
          where: { tutorProfileId: profile.id },
          data: { isDefault: false },
        });
      }
      return tx.tutorPayoutAccount.create({
        data: {
          id: newId(),
          tutorProfileId: profile.id,
          bankCode: dto.bank_code,
          accountNumber: dto.account_number,
          accountHolder: dto.account_holder,
          isDefault: dto.is_default ?? false,
        },
      });
    });
    return {
      id: account.id,
      bank_code: account.bankCode,
      // Che bớt số tài khoản (PII) khi trả về.
      account_number_masked: this.maskAccount(account.accountNumber),
      account_holder: account.accountHolder,
      is_default: account.isDefault,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    };
  }

  // ---- Public detail (paywall) ----
  async publicDetail(id: string, viewer?: AuthUser) {
    const p = await this.prisma.tutorProfile.findFirst({
      where: { id, status: 'published' },
      include: { subjects: true, gradeLevels: true, teachingModes: true },
    });
    if (!p) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không tìm thấy gia sư');
    }

    // Trạng thái mở khóa (nếu người xem là phụ huynh đã đăng nhập).
    let unlocked = false;
    let unlockVia: 'single_unlock' | 'vip_subscription' | null = null;
    if (viewer?.parentProfileId) {
      const state = await this.access.profileUnlockState(
        viewer.parentProfileId,
        viewer.userId,
        p.id,
      );
      unlocked = state.unlocked;
      unlockVia = state.via;
    }

    const preview = {
      id: p.id,
      display_name: p.displayName,
      avatar_media_id: p.avatarMediaId,
      region: p.region,
      education_level: p.educationLevel,
      school_name: p.schoolName,
      gender: p.gender,
      voice_accent: p.voiceAccent,
      subjects: p.subjects.map((s) => s.subjectCode),
      grade_levels: p.gradeLevels.map((g) => g.gradeLevel),
      teaching_modes: p.teachingModes.map((t) => t.mode),
      fee_min: p.expectedFeeMin != null ? Number(p.expectedFeeMin) : null,
      fee_max: p.expectedFeeMax != null ? Number(p.expectedFeeMax) : null,
      rating_avg: p.ratingAvg,
      rating_count: p.ratingCount,
      bio_snippet: p.bio ? p.bio.slice(0, 160) : null,
    };

    if (!unlocked) {
      return {
        ...preview,
        unlock_state: 'locked',
        unlock_via: null,
        paywall: {
          message:
            'Mở khóa hồ sơ để xem video giới thiệu và nhận xét chi tiết từ phụ huynh.',
          products: ['single_unlock', 'parent_vip'],
        },
      };
    }

    // Đã mở khóa: trả bio đầy đủ, video (signed URL ngắn hạn), review published.
    const reviews = await this.prisma.review.findMany({
      where: { tutorProfileId: p.id, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    const introVideoUrl = await this.introVideoUrl(p.introVideoMediaId);

    return {
      ...preview,
      unlock_state: 'unlocked',
      unlock_via: unlockVia,
      bio: p.bio,
      intro_video_url: introVideoUrl,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }

  // ---- Media upload URL ----
  async createUploadUrl(userId: string, dto: MediaUploadDto) {
    this.media.validate(dto.kind, dto.content_type, dto.size);
    const mediaId = newId();
    const storageKey = this.media.storageKeyFor(userId, mediaId, dto.kind);
    await this.prisma.mediaAsset.create({
      data: {
        id: mediaId,
        ownerUserId: userId,
        kind: dto.kind,
        storageKey,
        contentType: dto.content_type,
        sizeBytes: BigInt(dto.size),
      },
    });
    const upload = this.media.createUploadUrl(storageKey);
    return {
      media_id: mediaId,
      upload_url: upload.url,
      expires_at: upload.expires_at,
    };
  }

  // ---------- helpers ----------
  private scalarData(dto: ProfileInput): TutorScalarData {
    const d: TutorScalarData = {};
    if (dto.display_name !== undefined)
      d.displayName = this.requiredTrim(dto.display_name, 'display_name');
    if (dto.bio !== undefined) d.bio = dto.bio;
    if (dto.region !== undefined) d.region = dto.region;
    if (dto.voice_accent !== undefined) d.voiceAccent = dto.voice_accent;
    if (dto.gender !== undefined) d.gender = dto.gender;
    if (dto.education_level !== undefined) d.educationLevel = dto.education_level;
    if (dto.school_name !== undefined) d.schoolName = dto.school_name;
    if (dto.student_year !== undefined) d.studentYear = dto.student_year;
    if (dto.exam_score !== undefined) d.examScore = dto.exam_score;
    if (dto.gpa !== undefined) d.gpa = dto.gpa;
    if (dto.expected_fee_min !== undefined)
      d.expectedFeeMin = BigInt(dto.expected_fee_min);
    if (dto.expected_fee_max !== undefined)
      d.expectedFeeMax = BigInt(dto.expected_fee_max);
    if (dto.avatar_media_id !== undefined) d.avatarMediaId = dto.avatar_media_id;
    if (dto.intro_video_media_id !== undefined)
      d.introVideoMediaId = dto.intro_video_media_id;
    return d;
  }

  private async syncNormalized(
    tx: Db,
    tutorProfileId: string,
    dto: ProfileInput,
  ): Promise<void> {
    if (dto.subjects !== undefined) {
      await tx.tutorSubject.deleteMany({ where: { tutorProfileId } });
      if (dto.subjects.length) {
        await tx.tutorSubject.createMany({
          data: [...new Set(dto.subjects)].map((subjectCode) => ({
            id: newId(),
            tutorProfileId,
            subjectCode,
          })),
          skipDuplicates: true,
        });
      }
    }
    if (dto.grade_levels !== undefined) {
      await tx.tutorGradeLevel.deleteMany({ where: { tutorProfileId } });
      if (dto.grade_levels.length) {
        await tx.tutorGradeLevel.createMany({
          data: [...new Set(dto.grade_levels)].map((gradeLevel) => ({
            id: newId(),
            tutorProfileId,
            gradeLevel,
          })),
          skipDuplicates: true,
        });
      }
    }
    if (dto.teaching_modes !== undefined) {
      await tx.tutorTeachingMode.deleteMany({ where: { tutorProfileId } });
      if (dto.teaching_modes.length) {
        await tx.tutorTeachingMode.createMany({
          data: [...new Set(dto.teaching_modes)].map((mode) => ({
            id: newId(),
            tutorProfileId,
            mode,
          })),
          skipDuplicates: true,
        });
      }
    }
    if (dto.offline_areas !== undefined) {
      await tx.tutorOfflineArea.deleteMany({ where: { tutorProfileId } });
      if (dto.offline_areas.length) {
        await tx.tutorOfflineArea.createMany({
          data: dto.offline_areas.map((a) => ({
            id: newId(),
            tutorProfileId,
            provinceCode: a.province_code,
            districtCode: a.district_code ?? null,
          })),
        });
      }
    }
  }

  private async requireOwnProfile(userId: string) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        expectedFeeMin: true,
        expectedFeeMax: true,
      },
    });
    if (!profile) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Chưa có hồ sơ gia sư');
    }
    return profile;
  }

  private assertFeeRange(
    dto: ProfileInput,
    existing?: { expectedFeeMin: bigint | null; expectedFeeMax: bigint | null } | null,
  ): void {
    const min =
      dto.expected_fee_min !== undefined
        ? BigInt(dto.expected_fee_min)
        : existing?.expectedFeeMin ?? null;
    const max =
      dto.expected_fee_max !== undefined
        ? BigInt(dto.expected_fee_max)
        : existing?.expectedFeeMax ?? null;
    if (min !== null && max !== null && min > max) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'expected_fee_min phải nhỏ hơn hoặc bằng expected_fee_max',
        { expected_fee_min: Number(min), expected_fee_max: Number(max) },
      );
    }
  }

  private requiredTrim(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `${field} không được để trống`,
        { field },
      );
    }
    return trimmed;
  }

  private async getOwnProfile(id: string) {
    const p = await this.prisma.tutorProfile.findUnique({
      where: { id },
      include: {
        subjects: true,
        gradeLevels: true,
        teachingModes: true,
        offlineAreas: true,
      },
    });
    if (!p) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không tìm thấy hồ sơ');
    }
    return {
      id: p.id,
      display_name: p.displayName,
      bio: p.bio,
      region: p.region,
      voice_accent: p.voiceAccent,
      gender: p.gender,
      education_level: p.educationLevel,
      school_name: p.schoolName,
      student_year: p.studentYear,
      exam_score: p.examScore,
      gpa: p.gpa,
      fee_min: p.expectedFeeMin != null ? Number(p.expectedFeeMin) : null,
      fee_max: p.expectedFeeMax != null ? Number(p.expectedFeeMax) : null,
      avatar_media_id: p.avatarMediaId,
      intro_video_media_id: p.introVideoMediaId,
      status: p.status,
      moderation_status: p.moderationStatus,
      rating_avg: p.ratingAvg,
      rating_count: p.ratingCount,
      version: p.version,
      subjects: p.subjects.map((s) => s.subjectCode),
      grade_levels: p.gradeLevels.map((g) => g.gradeLevel),
      teaching_modes: p.teachingModes.map((t) => t.mode),
      offline_areas: p.offlineAreas.map((a) => ({
        province_code: a.provinceCode,
        district_code: a.districtCode,
      })),
    };
  }

  private async introVideoUrl(mediaId: string | null): Promise<string | null> {
    if (!mediaId) return null;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        moderationStatus: 'approved',
        scanStatus: 'clean',
      },
      select: { storageKey: true },
    });
    return asset ? this.media.signedReadUrl(asset.storageKey) : null;
  }

  private maskAccount(acc: string): string {
    if (acc.length <= 4) return '****';
    return `****${acc.slice(-4)}`;
  }
}
