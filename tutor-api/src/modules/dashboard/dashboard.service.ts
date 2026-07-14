import { Injectable } from '@nestjs/common';
import { LessonLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AccessService } from '../../common/shared/access.service';
import {
  buildKeyset,
  clampLimit,
  decodeCursor,
  encodeCursor,
  KeysetResult,
} from '../../common/pagination/keyset';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

type LessonItem = ReturnType<DashboardService['toLesson']>;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async studentOverview(userId: string, studentId: string) {
    const student = await this.requireOwnStudent(userId, studentId);
    const classes = await this.prisma.classContract.findMany({
      where: { studentId, parentProfileId: student.parentProfileId },
      include: {
        tutorProfile: { select: { id: true, displayName: true, avatarMediaId: true } },
        _count: { select: { lessonLogs: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    const latestLog = await this.prisma.lessonLog.findFirst({
      where: { classContract: { studentId, parentProfileId: student.parentProfileId } },
      orderBy: [{ lessonAt: 'desc' }, { id: 'desc' }],
    });

    const activeCount = classes.filter((c) =>
      ['trial_accepted', 'active', 'paused'].includes(c.status),
    ).length;

    return {
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        learning_goals: student.learningGoals,
      },
      summary: {
        total_classes: classes.length,
        active_classes: activeCount,
        total_lesson_logs: classes.reduce((sum, c) => sum + c._count.lessonLogs, 0),
        latest_lesson_at: latestLog?.lessonAt.toISOString() ?? null,
      },
      latest_lesson: latestLog
        ? {
            id: latestLog.id,
            class_contract_id: latestLog.classContractId,
            subject: latestLog.subject,
            absorption_level: latestLog.absorptionLevel,
            lesson_at: latestLog.lessonAt.toISOString(),
          }
        : null,
      classes: classes.map((c) => ({
        id: c.id,
        subject: c.subject,
        status: c.status,
        tutor: {
          id: c.tutorProfile.id,
          display_name: c.tutorProfile.displayName,
          avatar_media_id: c.tutorProfile.avatarMediaId,
        },
        lesson_log_count: c._count.lessonLogs,
        started_at: c.startedAt?.toISOString() ?? null,
        ended_at: c.endedAt?.toISOString() ?? null,
      })),
    };
  }

  async studentDetail(
    userId: string,
    studentId: string,
    query: PaginationQueryDto,
  ): Promise<{
    student: { id: string; name: string; grade: string };
    growth: Record<string, number>;
    timeline: KeysetResult<LessonItem>;
  }> {
    const student = await this.requireOwnStudent(userId, studentId);
    await this.access.assertTracking(userId, studentId);

    const limit = clampLimit(query.limit);
    const where = this.lessonCursorWhere(student.parentProfileId, studentId, query.cursor);
    const rows = await this.prisma.lessonLog.findMany({
      where,
      include: {
        classContract: { select: { id: true, subject: true } },
      },
      orderBy: [{ lessonAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (l) =>
      encodeCursor(l.lessonAt.toISOString(), l.id),
    );

    const growth = await this.prisma.lessonLog.groupBy({
      by: ['absorptionLevel'],
      where: {
        classContract: { studentId, parentProfileId: student.parentProfileId },
      },
      _count: { absorptionLevel: true },
    });

    return {
      student: { id: student.id, name: student.name, grade: student.grade },
      growth: growth.reduce<Record<string, number>>((acc, g) => {
        acc[g.absorptionLevel] = g._count.absorptionLevel;
        return acc;
      }, {}),
      timeline: {
        items: page.items.map((l) => this.toLesson(l)),
        next_cursor: page.next_cursor,
      },
    };
  }

  private async requireOwnStudent(userId: string, studentId: string) {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!parent) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Chưa có hồ sơ phụ huynh');
    }
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, parentProfileId: parent.id },
    });
    if (!student) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy học sinh của bạn',
      );
    }
    return student;
  }

  private lessonCursorWhere(
    parentProfileId: string,
    studentId: string,
    cursor?: string,
  ) {
    const where: {
      classContract: { studentId: string; parentProfileId: string };
      OR?: ({ lessonAt: { lt: Date } } | { lessonAt: Date; id: { lt: string } })[];
    } = { classContract: { studentId, parentProfileId } };
    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    if (!decoded) return where;
    const [value, id] = decoded;
    if (typeof value !== 'string') {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    const lessonAt = new Date(value);
    if (Number.isNaN(lessonAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    where.OR = [{ lessonAt: { lt: lessonAt } }, { lessonAt, id: { lt: id } }];
    return where;
  }

  private toLesson(
    l: LessonLog & { classContract?: { id: string; subject: string } | null },
  ) {
    return {
      id: l.id,
      class_contract_id: l.classContractId,
      class_subject: l.classContract?.subject ?? null,
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
}
