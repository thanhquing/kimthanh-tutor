import { Injectable } from "@nestjs/common";
import { ClassContract, LessonLog } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppException } from "../../common/errors/app.exception";
import { ErrorCode } from "../../common/errors/error-codes";
import { newId } from "../../common/utils/id.util";
import { OutboxService } from "../../common/shared/outbox.service";
import {
  buildKeyset,
  clampLimit,
  decodeCursor,
  encodeCursor,
} from "../../common/pagination/keyset";
import {
  LessonLogDto,
  LessonLogsQueryDto,
  TransitionDto,
  UpdateLessonLogDto,
} from "./dto/class.dto";

const TRANSITIONS: Record<string, Set<string>> = {
  trial_accepted: new Set(["active", "cancelled"]),
  active: new Set(["paused", "completed_pending_review", "cancelled"]),
  paused: new Set(["active", "cancelled"]),
  completed_pending_review: new Set(["completed"]),
  completed: new Set(),
  cancelled: new Set(),
};

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async mine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { parentProfile: true, tutorProfile: true },
    });
    if (!user) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "User không tồn tại",
      );
    }

    const OR = [];
    if (user.parentProfile) OR.push({ parentProfileId: user.parentProfile.id });
    if (user.tutorProfile) OR.push({ tutorProfileId: user.tutorProfile.id });
    if (OR.length === 0) return { items: [] };

    const items = await this.prisma.classContract.findMany({
      where: { OR },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return { items: items.map((c) => this.toClass(c)) };
  }

  async transition(userId: string, id: string, dto: TransitionDto) {
    const current = await this.requireClassForUser(userId, id);
    const allowed = TRANSITIONS[current.status] ?? new Set<string>();
    if (!allowed.has(dto.to)) {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Không thể chuyển lớp từ ${current.status} sang ${dto.to}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.classContract.updateMany({
        where: { id, version: current.version, status: current.status },
        data: {
          status: dto.to,
          version: { increment: 1 },
          ...(dto.to === "active" && !current.startedAt
            ? { startedAt: new Date() }
            : {}),
          ...(["completed_pending_review", "completed", "cancelled"].includes(
            dto.to,
          )
            ? { endedAt: new Date() }
            : {}),
        },
      });
      if (result.count !== 1) {
        throw new AppException(
          ErrorCode.CONFLICT,
          "Lớp vừa được cập nhật bởi thao tác khác",
        );
      }
      const next = await tx.classContract.findUniqueOrThrow({ where: { id } });
      await this.outbox.emit(tx, {
        aggregateType: "class_contract",
        aggregateId: id,
        eventType: "class.transitioned",
        payload: { class_contract_id: id, from: current.status, to: dto.to },
      });
      return next;
    });
    return this.toClass(updated);
  }

  async createLessonLog(userId: string, id: string, dto: LessonLogDto) {
    const klass = await this.requireTutorClass(userId, id);
    if (!["active", "paused"].includes(klass.status)) {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        "Chỉ lớp active/paused mới được tạo sổ buổi học",
      );
    }
    const subject = this.requiredTrim(dto.subject, "subject");
    const log = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lessonLog.create({
        data: {
          id: newId(),
          classContractId: klass.id,
          tutorProfileId: klass.tutorProfileId,
          lessonAt: dto.lesson_at ?? new Date(),
          subject,
          content: this.optionalTrim(dto.content),
          homework: this.optionalTrim(dto.homework),
          absorptionLevel: dto.absorption_level,
          tutorNote: this.optionalTrim(dto.tutor_note),
        },
      });
      await this.outbox.emit(tx, {
        aggregateType: "lesson_log",
        aggregateId: created.id,
        eventType: "lesson_log.created",
        payload: {
          lesson_log_id: created.id,
          class_contract_id: klass.id,
          parent_profile_id: klass.parentProfileId,
          student_id: klass.studentId,
        },
      });
      return created;
    });
    return this.toLessonLog(log);
  }

  async listLessonLogs(userId: string, id: string, query: LessonLogsQueryDto) {
    const klass = await this.requireTutorClass(userId, id);
    const limit = clampLimit(query.limit);
    const where = this.lessonLogCursorWhere(
      klass.id,
      klass.tutorProfileId,
      query.cursor,
    );
    const rows = await this.prisma.lessonLog.findMany({
      where,
      orderBy: [{ lessonAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (log) =>
      encodeCursor(log.lessonAt.toISOString(), log.id),
    );
    return {
      items: page.items.map((log) => this.toLessonLog(log)),
      next_cursor: page.next_cursor,
    };
  }

  async updateLessonLog(userId: string, id: string, dto: UpdateLessonLogDto) {
    const log = await this.prisma.lessonLog.findFirst({
      where: { id },
      include: { classContract: true },
    });
    if (!log) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy sổ buổi học",
      );
    }
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tutor || tutor.id !== log.tutorProfileId) {
      throw new AppException(
        ErrorCode.FORBIDDEN_ROLE,
        "Không phải gia sư của lớp",
      );
    }
    if (Date.now() - log.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        "Chỉ được sửa sổ buổi học trong 7 ngày",
      );
    }

    const updated = await this.prisma.lessonLog.update({
      where: { id },
      data: {
        ...(dto.lesson_at !== undefined ? { lessonAt: dto.lesson_at } : {}),
        ...(dto.subject !== undefined
          ? { subject: this.requiredTrim(dto.subject, "subject") }
          : {}),
        ...(dto.content !== undefined
          ? { content: this.optionalTrim(dto.content) }
          : {}),
        ...(dto.homework !== undefined
          ? { homework: this.optionalTrim(dto.homework) }
          : {}),
        ...(dto.absorption_level !== undefined
          ? { absorptionLevel: dto.absorption_level }
          : {}),
        ...(dto.tutor_note !== undefined
          ? { tutorNote: this.optionalTrim(dto.tutor_note) }
          : {}),
      },
    });
    return this.toLessonLog(updated);
  }

  private async requireClassForUser(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { parentProfile: true, tutorProfile: true },
    });
    if (!user) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "User không tồn tại",
      );
    }
    const klass = await this.prisma.classContract.findFirst({
      where: {
        id,
        OR: [
          ...(user.parentProfile
            ? [{ parentProfileId: user.parentProfile.id }]
            : []),
          ...(user.tutorProfile
            ? [{ tutorProfileId: user.tutorProfile.id }]
            : []),
        ],
      },
    });
    if (!klass) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy lớp",
      );
    }
    return klass;
  }

  private async requireTutorClass(userId: string, id: string) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tutor) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, "Chưa có hồ sơ gia sư");
    }
    const klass = await this.prisma.classContract.findFirst({
      where: { id, tutorProfileId: tutor.id },
    });
    if (!klass) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy lớp",
      );
    }
    return klass;
  }

  private lessonLogCursorWhere(
    classContractId: string,
    tutorProfileId: string,
    cursor?: string,
  ) {
    const where = {
      classContractId,
      tutorProfileId,
      deletedAt: null,
    };
    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    if (!decoded) return where;

    const [value, id] = decoded;
    const lessonAt = new Date(String(value));
    if (Number.isNaN(lessonAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    return {
      ...where,
      OR: [{ lessonAt: { lt: lessonAt } }, { lessonAt, id: { lt: id } }],
    };
  }

  private toClass(c: ClassContract) {
    return {
      id: c.id,
      trial_request_id: c.trialRequestId,
      parent_profile_id: c.parentProfileId,
      student_id: c.studentId,
      tutor_profile_id: c.tutorProfileId,
      subject: c.subject,
      status: c.status,
      version: c.version,
      started_at: c.startedAt?.toISOString() ?? null,
      ended_at: c.endedAt?.toISOString() ?? null,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    };
  }

  private toLessonLog(l: LessonLog) {
    return {
      id: l.id,
      class_contract_id: l.classContractId,
      tutor_profile_id: l.tutorProfileId,
      lesson_at: l.lessonAt.toISOString(),
      subject: l.subject,
      content: l.content,
      homework: l.homework,
      absorption_level: l.absorptionLevel,
      tutor_note: l.tutorNote,
      created_at: l.createdAt.toISOString(),
      updated_at: l.updatedAt.toISOString(),
    };
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

  private optionalTrim(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
