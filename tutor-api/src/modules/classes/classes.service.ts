import { Injectable } from "@nestjs/common";
import { ClassContract, LessonLog, Prisma } from "@prisma/client";
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
  ClassesMineQueryDto,
  LessonLogDto,
  LessonLogsQueryDto,
  TransitionDto,
  UpdateLessonLogDto,
} from "./dto/class.dto";
import { AuthUser } from "../../common/auth/auth-user";

type ClassTransitionTarget =
  | "active"
  | "paused"
  | "completed_pending_review"
  | "cancelled";

const TUTOR_TRANSITIONS: Record<string, ClassTransitionTarget[]> = {
  trial_accepted: ["active", "cancelled"],
  active: ["paused", "completed_pending_review", "cancelled"],
  paused: ["active", "cancelled"],
  completed_pending_review: [],
  completed: [],
  cancelled: [],
};

const PARENT_TRANSITIONS: Record<string, ClassTransitionTarget[]> = {
  trial_accepted: ["cancelled"],
  active: ["cancelled"],
  paused: ["cancelled"],
  completed_pending_review: [],
  completed: [],
  cancelled: [],
};

const CLASS_RELATIONS = {
  parentProfile: { select: { id: true, displayName: true } },
  student: { select: { id: true, name: true, grade: true } },
  trialRequest: {
    select: { teachingMode: true, preferredSchedule: true },
  },
} satisfies Prisma.ClassContractInclude;

type ClassWithRelations = Prisma.ClassContractGetPayload<{
  include: typeof CLASS_RELATIONS;
}>;
type ClassActor = "parent" | "tutor";

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async mine(user: AuthUser, query: ClassesMineQueryDto) {
    const roles = query.role
      ? user.roles.includes(query.role)
        ? [query.role]
        : []
      : (["parent", "tutor"] as const).filter((role) =>
          user.roles.includes(role),
        );
    const OR: Prisma.ClassContractWhereInput[] = [];
    if (roles.includes("parent") && user.parentProfileId) {
      OR.push({ parentProfileId: user.parentProfileId });
    }
    if (roles.includes("tutor") && user.tutorProfileId) {
      OR.push({ tutorProfileId: user.tutorProfileId });
    }
    if (OR.length === 0) return { items: [], next_cursor: null };

    const limit = clampLimit(query.limit, 20, 50);
    const cursorWhere = this.updatedAtCursorWhere(query.cursor);
    const rows = await this.prisma.classContract.findMany({
      where: {
        AND: [
          { OR },
          ...(query.status ? [{ status: query.status }] : []),
          ...(query.cursor ? [cursorWhere] : []),
        ],
      },
      include: CLASS_RELATIONS,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (item) =>
      encodeCursor(item.updatedAt.toISOString(), item.id),
    );
    return {
      items: page.items.map((klass) =>
        this.toClassDetail(klass, this.actorFor(user, klass)),
      ),
      next_cursor: page.next_cursor,
    };
  }

  async detail(user: AuthUser, id: string) {
    const { klass, actor } = await this.requireClassForActor(user, id);
    return this.toClassDetail(klass, actor);
  }

  async transition(user: AuthUser, id: string, dto: TransitionDto) {
    const { klass: current, actor } = await this.requireClassForActor(user, id);
    const allowed = this.transitionsFor(actor, current.status);
    if (
      dto.expected_version !== undefined &&
      dto.expected_version !== current.version
    ) {
      this.throwClassConflict(current, actor);
    }
    if (!allowed.includes(dto.to)) {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Không thể chuyển lớp từ ${current.status} sang ${dto.to}`,
        { class_contract: this.toClassDetail(current, actor) },
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.classContract.updateMany({
        where: {
          id,
          version: dto.expected_version ?? current.version,
          status: current.status,
          ...(actor === "tutor"
            ? { tutorProfileId: user.tutorProfileId! }
            : { parentProfileId: user.parentProfileId! }),
        },
        data: {
          status: dto.to,
          version: { increment: 1 },
          ...(dto.to === "active" && !current.startedAt
            ? { startedAt: new Date() }
            : {}),
          ...(["completed_pending_review", "cancelled"].includes(dto.to)
            ? { endedAt: new Date() }
            : {}),
        },
      });
      if (result.count !== 1) {
        const latest = await tx.classContract.findUnique({
          where: { id },
          include: CLASS_RELATIONS,
        });
        this.throwClassConflict(latest ?? current, actor);
      }
      const next = await tx.classContract.findUniqueOrThrow({
        where: { id },
        include: CLASS_RELATIONS,
      });
      await this.outbox.emit(tx, {
        aggregateType: "class_contract",
        aggregateId: id,
        eventType: "class.transitioned",
        payload: { class_contract_id: id, from: current.status, to: dto.to },
      });
      return next;
    });
    return this.toClassDetail(updated, actor);
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

  private async requireClassForActor(user: AuthUser, id: string) {
    const OR: Prisma.ClassContractWhereInput[] = [];
    if (user.roles.includes("parent") && user.parentProfileId) {
      OR.push({ parentProfileId: user.parentProfileId });
    }
    if (user.roles.includes("tutor") && user.tutorProfileId) {
      OR.push({ tutorProfileId: user.tutorProfileId });
    }
    if (OR.length === 0) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, "Không thuộc lớp");
    }
    const klass = await this.prisma.classContract.findFirst({
      where: { id, OR },
      include: CLASS_RELATIONS,
    });
    if (!klass) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy lớp",
      );
    }
    return { klass, actor: this.actorFor(user, klass) };
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

  private toClassDetail(c: ClassWithRelations, actor: ClassActor) {
    return {
      ...this.toClass(c),
      parent: c.parentProfile
        ? { id: c.parentProfile.id, display_name: c.parentProfile.displayName }
        : null,
      student: c.student
        ? { id: c.student.id, name: c.student.name, grade: c.student.grade }
        : null,
      requested_teaching_mode: c.trialRequest?.teachingMode ?? null,
      requested_schedule: c.trialRequest?.preferredSchedule ?? null,
      capabilities: {
        transitions: this.transitionsFor(actor, c.status),
        can_create_lesson_log:
          actor === "tutor" && ["active", "paused"].includes(c.status),
        can_view_review:
          actor === "tutor" &&
          ["completed_pending_review", "completed"].includes(c.status),
      },
    };
  }

  private actorFor(user: AuthUser, klass: ClassContract): ClassActor {
    if (
      user.roles.includes("tutor") &&
      user.tutorProfileId === klass.tutorProfileId
    ) {
      return "tutor";
    }
    if (
      user.roles.includes("parent") &&
      user.parentProfileId === klass.parentProfileId
    ) {
      return "parent";
    }
    throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy lớp");
  }

  private transitionsFor(
    actor: ClassActor,
    status: string,
  ): ClassTransitionTarget[] {
    const transitions =
      actor === "tutor" ? TUTOR_TRANSITIONS[status] : PARENT_TRANSITIONS[status];
    return [...(transitions ?? [])];
  }

  private throwClassConflict(klass: ClassWithRelations, actor: ClassActor): never {
    throw new AppException(
      ErrorCode.CONFLICT,
      "Lớp vừa được cập nhật bởi thao tác khác",
      { class_contract: this.toClassDetail(klass, actor) },
    );
  }

  private updatedAtCursorWhere(cursor?: string): Prisma.ClassContractWhereInput {
    if (!cursor) return {};
    const decoded = decodeCursor(cursor);
    if (!decoded || typeof decoded[0] !== "string") {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    const updatedAt = new Date(decoded[0]);
    if (Number.isNaN(updatedAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    return {
      OR: [
        { updatedAt: { lt: updatedAt } },
        { updatedAt, id: { lt: decoded[1] } },
      ],
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
