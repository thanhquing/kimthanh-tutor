import { Injectable } from '@nestjs/common';
import {
  ClassStatus,
  CollectionStatus,
  LessonLog,
  Prisma,
  Subscription,
} from '@prisma/client';
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
type TutorDashboardSection =
  | 'pending_trials'
  | 'teaching_classes'
  | 'pending_qr_records'
  | 'qr_subscription';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async tutorOverview(userId: string) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        status: true,
        moderationStatus: true,
        _count: { select: { payoutAccounts: true } },
      },
    });
    if (!tutor) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Chưa có hồ sơ gia sư');
    }

    const sections: TutorDashboardSection[] = [
      'pending_trials',
      'teaching_classes',
      'pending_qr_records',
      'qr_subscription',
    ];
    const settled = await Promise.allSettled([
      this.loadPendingTrials(tutor.id),
      this.loadTeachingClasses(tutor.id),
      this.loadPendingQrRecords(tutor.id),
      this.loadQrSubscription(userId),
    ]);
    const partialErrors = settled.flatMap((result, index) =>
      result.status === 'rejected' ? [sections[index]] : [],
    );

    const trials = settled[0].status === 'fulfilled'
      ? settled[0].value
      : { count: 0, items: [] };
    const classes = settled[1].status === 'fulfilled'
      ? settled[1].value
      : { count: 0, items: [] };
    const qrRecords = settled[2].status === 'fulfilled'
      ? settled[2].value
      : { count: 0, items: [] };
    const qrSubscription = settled[3].status === 'fulfilled'
      ? settled[3].value
      : { subscription: null, active: false };
    const hasPayoutAccount = tutor._count.payoutAccounts > 0;

    return {
      profile: {
        id: tutor.id,
        display_name: tutor.displayName,
        status: tutor.status,
        moderation_status: tutor.moderationStatus,
      },
      summary: {
        pending_trials: trials.count,
        teaching_classes: classes.count,
        pending_qr_records: qrRecords.count,
      },
      pending_trials: trials.items,
      teaching_classes: classes.items,
      pending_qr_records: qrRecords.items,
      qr_subscription: qrSubscription.subscription,
      capabilities: {
        has_payout_account: hasPayoutAccount,
        has_active_qr_access: qrSubscription.active,
        can_create_qr: hasPayoutAccount && qrSubscription.active,
      },
      partial_errors: partialErrors,
    };
  }

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

  private async loadPendingTrials(tutorProfileId: string) {
    const where = { tutorProfileId, status: 'pending' as const };
    const [count, rows] = await Promise.all([
      this.prisma.trialRequest.count({ where }),
      this.prisma.trialRequest.findMany({
        where,
        select: {
          id: true,
          subject: true,
          grade: true,
          teachingMode: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);
    return {
      count,
      items: rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        grade: row.grade === null ? null : Number(row.grade),
        teaching_mode:
          row.teachingMode === 'online' || row.teachingMode === 'offline'
            ? row.teachingMode
            : null,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  private async loadTeachingClasses(tutorProfileId: string) {
    const where = {
      tutorProfileId,
      status: { in: ['trial_accepted', 'active'] as ClassStatus[] },
    };
    const [count, rows] = await Promise.all([
      this.prisma.classContract.count({ where }),
      this.prisma.classContract.findMany({
        where,
        select: {
          id: true,
          subject: true,
          status: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 6,
      }),
    ]);
    const classIds = rows.map((row) => row.id);
    // DISTINCT ON chạy tại PostgreSQL và chỉ trả tối đa một dòng/lớp. Prisma
    // `distinct` hiện post-process trong memory nên có thể kéo toàn bộ log về;
    // query parameterized này giữ response/query bounded và không N+1.
    const latestLogs = classIds.length === 0
      ? []
      : await this.prisma.$queryRaw<
          Array<{
            id: string;
            classContractId: string;
            lessonAt: Date;
            subject: string;
          }>
        >(Prisma.sql`
          SELECT DISTINCT ON (class_contract_id)
            id,
            class_contract_id AS "classContractId",
            lesson_at AS "lessonAt",
            subject
          FROM lesson_logs
          WHERE tutor_profile_id = ${tutorProfileId}
            AND deleted_at IS NULL
            AND class_contract_id IN (${Prisma.join(classIds)})
          ORDER BY class_contract_id, lesson_at DESC, id DESC
        `);
    const latestByClass = new Map(latestLogs.map((log) => [log.classContractId, log]));

    return {
      count,
      items: rows.map((row) => {
        const latest = latestByClass.get(row.id);
        return {
          id: row.id,
          subject: row.subject,
          status: row.status,
          latest_lesson: latest
            ? {
                id: latest.id,
                lesson_at: latest.lessonAt.toISOString(),
                subject: latest.subject,
              }
            : null,
          can_create_lesson_log: row.status === 'active',
          updated_at: row.updatedAt.toISOString(),
        };
      }),
    };
  }

  private async loadPendingQrRecords(tutorProfileId: string) {
    const where = {
      tutorProfileId,
      collectionStatus: { in: ['created', 'sent'] as CollectionStatus[] },
    };
    const [count, rows] = await Promise.all([
      this.prisma.tutorPaymentQrRecord.count({ where }),
      this.prisma.tutorPaymentQrRecord.findMany({
        where,
        select: {
          id: true,
          classContractId: true,
          amount: true,
          collectionStatus: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);
    return {
      count,
      items: rows.map((row) => ({
        id: row.id,
        class_contract_id: row.classContractId,
        amount: Number(row.amount),
        collection_status: row.collectionStatus,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  private async loadQrSubscription(userId: string) {
    const [subscription, active] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { userId, type: 'tutor_qr' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.access.hasTutorQrAccess(userId),
    ]);
    return {
      subscription: subscription ? this.toSubscription(subscription) : null,
      active,
    };
  }

  private toSubscription(subscription: Subscription) {
    return {
      id: subscription.id,
      type: subscription.type,
      scope_ref_id: subscription.scopeRefId,
      payment_id: subscription.paymentId,
      status: subscription.status,
      auto_renew: subscription.autoRenew,
      starts_at: subscription.startsAt?.toISOString() ?? null,
      current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelled_at: subscription.cancelledAt?.toISOString() ?? null,
      created_at: subscription.createdAt.toISOString(),
      updated_at: subscription.updatedAt.toISOString(),
    };
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
