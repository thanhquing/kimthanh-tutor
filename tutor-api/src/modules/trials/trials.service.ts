import { Injectable } from '@nestjs/common';
import {
  TrialRequest,
  ClassContract,
  Lead,
  Prisma,
  ActivationToken,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthUser } from '../../common/auth/auth-user';
import { newId } from '../../common/utils/id.util';
import { randomToken, sha256 } from '../../common/utils/hash.util';
import { OutboxService } from '../../common/shared/outbox.service';
import {
  ActivationDto,
  CreateTrialDto,
  DeclineTrialDto,
  TrialActionDto,
  TrialMineQueryDto,
} from './dto/trial.dto';
import {
  buildKeyset,
  clampLimit,
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/keyset';

const ACTIVATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ACTIVATION_PURPOSE = 'guest_trial_activation';
const GUEST_TRIAL_PHONE_WINDOW_MS =
  Number(process.env.GUEST_TRIAL_PHONE_WINDOW_SECONDS ?? 3600) * 1000;
const GUEST_TRIAL_PHONE_LIMIT = Number(
  process.env.GUEST_TRIAL_PHONE_LIMIT ?? 3,
);
type ActivationTokenStore = Pick<Prisma.TransactionClient, 'activationToken'>;
type TrialPresenterInput = TrialRequest & {
  classContract?: ClassContract | null;
  lead?: Lead | null;
  activationTokens?: Array<Pick<ActivationToken, 'consumedAt' | 'expiresAt'>>;
};

@Injectable()
export class TrialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  // POST /trials — guest tạo lead; parent đăng nhập link trực tiếp student/profile.
  async create(user: AuthUser | undefined, dto: CreateTrialDto) {
    const tutor = await this.prisma.tutorProfile.findFirst({
      where: { id: dto.tutor_profile_id, status: 'published' },
      select: { id: true, userId: true },
    });
    if (!tutor) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy gia sư đang xuất bản',
      );
    }

    const parentProfileId = user?.parentProfileId;
    let studentId: string | null = null;
    let leadId: string | null = null;
    let contactSnapshot: string | null = null;
    const subject = this.requiredTrim(dto.subject, 'subject');

    if (user) {
      if (!parentProfileId || !user.roles.includes('parent')) {
        throw new AppException(
          ErrorCode.FORBIDDEN_ROLE,
          'Chỉ phụ huynh hoặc khách được tạo yêu cầu học thử',
        );
      }
      if (dto.student_id) {
        const student = await this.prisma.student.findFirst({
          where: { id: dto.student_id, parentProfileId },
          select: { id: true, grade: true, learningGoals: true },
        });
        if (!student) {
          throw new AppException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Không tìm thấy học sinh của bạn',
          );
        }
        studentId = student.id;
      }
    } else {
      const contactName =
        dto.contact_name !== undefined
          ? this.requiredTrim(dto.contact_name, 'contact_name')
          : null;
      const contactPhone =
        dto.contact_phone !== undefined
          ? this.requiredTrim(dto.contact_phone, 'contact_phone')
          : null;
      if (!contactName || !contactPhone) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          'Guest cần contact_name và contact_phone',
        );
      }
      const recentByPhone = await this.prisma.lead.count({
        where: {
          contactPhone,
          createdAt: {
            gte: new Date(Date.now() - GUEST_TRIAL_PHONE_WINDOW_MS),
          },
        },
      });
      if (recentByPhone >= GUEST_TRIAL_PHONE_LIMIT) {
        throw new AppException(
          ErrorCode.RATE_LIMITED,
          'Số điện thoại đã gửi quá nhiều yêu cầu học thử, vui lòng thử lại sau',
        );
      }
      const lead = await this.prisma.lead.create({
        data: {
          id: newId(),
          contactName,
          contactPhone,
          contactEmail: dto.contact_email?.trim().toLowerCase() ?? null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      leadId = lead.id;
      contactSnapshot = JSON.stringify({
        name: contactName,
        phone: contactPhone,
        email: dto.contact_email ?? null,
      });
    }

    const trial = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trialRequest.create({
        data: {
          id: newId(),
          parentProfileId: parentProfileId ?? null,
          leadId,
          studentId,
          tutorProfileId: tutor.id,
          subject,
          grade: this.optionalTrim(dto.grade),
          learningGoal: this.optionalTrim(dto.learning_goal),
          teachingMode: dto.teaching_mode ?? null,
          preferredSchedule: this.optionalTrim(dto.preferred_schedule),
          message: this.optionalTrim(dto.message),
          contactSnapshot,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      await this.outbox.emit(tx, {
        aggregateType: 'trial_request',
        aggregateId: created.id,
        eventType: 'trial.created',
        payload: {
          trial_id: created.id,
          tutor_profile_id: tutor.id,
          parent_profile_id: parentProfileId ?? null,
          lead_id: leadId,
        },
      });
      return created;
    });

    return this.toTrial(trial);
  }

  async mine(user: AuthUser, query: TrialMineQueryDto) {
    const roles =
      query.role !== undefined
        ? user.roles.includes(query.role)
          ? [query.role]
          : []
        : (['parent', 'tutor'] as const).filter((r) => user.roles.includes(r));
    const OR = [];
    if (roles.includes('parent') && user.parentProfileId) {
      OR.push({ parentProfileId: user.parentProfileId });
    }
    if (roles.includes('tutor') && user.tutorProfileId) {
      OR.push({ tutorProfileId: user.tutorProfileId });
    }
    if (OR.length === 0) return { items: [], next_cursor: null };

    const limit = clampLimit(query.limit, 20, 50);
    const cursorWhere = this.createdAtCursorWhere(query.cursor);
    const where: Prisma.TrialRequestWhereInput = {
      AND: [
        { OR },
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.cursor ? [cursorWhere] : []),
      ],
    };

    const rows = await this.prisma.trialRequest.findMany({
      where,
      include: {
        classContract: true,
        activationTokens: {
          select: { consumedAt: true, expiresAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (item) =>
      encodeCursor(item.createdAt.toISOString(), item.id),
    );
    return {
      items: page.items.map((item) => this.toTrial(item)),
      next_cursor: page.next_cursor,
    };
  }

  async accept(user: AuthUser, id: string, dto: TrialActionDto = {}) {
    if (!user.tutorProfileId) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Chưa có hồ sơ gia sư');
    }
    const trial = await this.prisma.trialRequest.findFirst({
      where: { id, tutorProfileId: user.tutorProfileId },
      include: { classContract: true, lead: true },
    });
    if (!trial) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy yêu cầu học thử',
      );
    }
    if (dto.expected_version !== undefined && dto.expected_version !== trial.version) {
      this.throwTrialConflict(trial);
    }
    if (trial.status !== 'pending') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Chỉ yêu cầu pending mới được chấp nhận',
        { trial: this.toTrial(trial) },
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.trialRequest.updateMany({
        where: {
          id: trial.id,
          version: dto.expected_version ?? trial.version,
          status: 'pending',
        },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        const current = await tx.trialRequest.findUnique({
          where: { id: trial.id },
          include: { classContract: true },
        });
        this.throwTrialConflict(current ?? trial);
      }

      const classContract = await tx.classContract.create({
        data: {
          id: newId(),
          trialRequestId: trial.id,
          parentProfileId: trial.parentProfileId,
          studentId: trial.studentId,
          tutorProfileId: trial.tutorProfileId,
          subject: trial.subject,
          status: 'trial_accepted',
        },
      });
      const activationToken = trial.leadId
        ? await this.createActivationToken(tx, trial.leadId, trial.id)
        : null;

      await this.outbox.emit(tx, {
        aggregateType: 'trial_request',
        aggregateId: trial.id,
        eventType: 'trial.accepted',
        payload: {
          trial_id: trial.id,
          class_contract_id: classContract.id,
          activation_token: activationToken,
        },
      });
      const accepted = await tx.trialRequest.findUniqueOrThrow({
        where: { id: trial.id },
      });
      return {
        accepted: { ...accepted, classContract },
        classContract,
        activationToken,
      };
    });

    return {
      trial: this.toTrial(result.accepted),
      class_contract: this.toClass(result.classContract),
      activation_token: result.activationToken,
    };
  }

  async decline(user: AuthUser, id: string, dto: DeclineTrialDto) {
    if (!user.tutorProfileId) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Chưa có hồ sơ gia sư');
    }
    const trial = await this.prisma.trialRequest.findFirst({
      where: { id, tutorProfileId: user.tutorProfileId },
    });
    if (!trial) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy yêu cầu học thử',
      );
    }
    if (dto.expected_version !== undefined && dto.expected_version !== trial.version) {
      this.throwTrialConflict(trial);
    }
    if (trial.status !== 'pending') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Chỉ yêu cầu pending mới được từ chối',
        { trial: this.toTrial(trial) },
      );
    }
    const reason = this.requiredTrim(dto.reason, 'reason');
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.trialRequest.updateMany({
        where: {
          id,
          tutorProfileId: user.tutorProfileId,
          status: 'pending',
          version: dto.expected_version ?? trial.version,
        },
        data: {
          status: 'declined',
          respondedAt: new Date(),
          declineReason: reason,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const current = await tx.trialRequest.findUnique({
          where: { id },
          include: { classContract: true },
        });
        this.throwTrialConflict(current ?? trial);
      }
      await this.outbox.emit(tx, {
        aggregateType: 'trial_request',
        aggregateId: id,
        eventType: 'trial.declined',
        payload: { trial_id: id },
      });
      const updated = await tx.trialRequest.findUniqueOrThrow({ where: { id } });
      return this.toTrial(updated);
    });
  }

  async cancel(user: AuthUser, id: string, dto: TrialActionDto = {}) {
    if (!user.parentProfileId) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Chưa có hồ sơ phụ huynh');
    }
    const trial = await this.prisma.trialRequest.findFirst({
      where: { id, parentProfileId: user.parentProfileId },
    });
    if (!trial) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy yêu cầu học thử',
      );
    }
    if (dto.expected_version !== undefined && dto.expected_version !== trial.version) {
      this.throwTrialConflict(trial);
    }
    if (trial.status !== 'pending') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Chỉ yêu cầu pending mới được hủy',
        { trial: this.toTrial(trial) },
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.trialRequest.updateMany({
        where: {
          id,
          parentProfileId: user.parentProfileId,
          status: 'pending',
          version: dto.expected_version ?? trial.version,
        },
        data: {
          status: 'cancelled',
          respondedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const current = await tx.trialRequest.findUnique({
          where: { id },
          include: { classContract: true },
        });
        this.throwTrialConflict(current ?? trial);
      }
      await this.outbox.emit(tx, {
        aggregateType: 'trial_request',
        aggregateId: id,
        eventType: 'trial.cancelled',
        payload: { trial_id: id },
      });
      const updated = await tx.trialRequest.findUniqueOrThrow({ where: { id } });
      return this.toTrial(updated);
    });
  }

  // Public activation for guest lead accepted by tutor.
  // Raw activation token is returned once; DB stores only hash + expiry + consumedAt.
  async completeActivation(dto: ActivationDto) {
    const token = await this.prisma.activationToken.findUnique({
      where: { tokenHash: sha256(dto.activation_token) },
      include: {
        lead: {
          include: { trialRequests: { include: { classContract: true } } },
        },
      },
    });
    if (
      !token ||
      token.purpose !== ACTIVATION_PURPOSE ||
      token.consumedAt ||
      token.expiresAt.getTime() < Date.now() ||
      token.lead.status !== 'new'
    ) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Token kích hoạt không hợp lệ',
      );
    }

    const acceptedTrial = token.lead.trialRequests.find(
      (t) =>
        t.status === 'accepted' &&
        t.classContract &&
        (!token.trialRequestId || t.id === token.trialRequestId),
    );
    if (!acceptedTrial?.classContract) {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Yêu cầu học thử chưa được gia sư chấp nhận',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.activationToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Token kích hoạt không hợp lệ',
        );
      }

      const lead = token.lead;
      let user = await tx.user.findUnique({ where: { phone: lead.contactPhone } });
      if (!user) {
        user = await tx.user.create({
          data: {
            id: newId(),
            phone: lead.contactPhone,
            email: lead.contactEmail,
            roles: ['parent'],
            status: 'pending_consent',
          },
        });
      } else if (!user.roles.includes('parent')) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { roles: { set: [...user.roles, 'parent'] } },
        });
      }

      const parent =
        (await tx.parentProfile.findUnique({ where: { userId: user.id } })) ??
        (await tx.parentProfile.create({
          data: {
            id: newId(),
            userId: user.id,
            displayName: lead.contactName,
          },
        }));

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'converted', convertedParentProfileId: parent.id },
      });
      await tx.trialRequest.updateMany({
        where: { leadId: lead.id },
        data: { parentProfileId: parent.id, leadId: null },
      });
      await tx.classContract.updateMany({
        where: { trialRequestId: acceptedTrial.id },
        data: { parentProfileId: parent.id },
      });

      return {
        user,
        parent,
        classContract: await tx.classContract.findUniqueOrThrow({
          where: { id: acceptedTrial.classContract!.id },
        }),
      };
    });

    return {
      user: {
        id: result.user.id,
        phone: result.user.phone,
        status: result.user.status,
      },
      parent_profile: {
        id: result.parent.id,
        display_name: result.parent.displayName,
      },
      class_contract: this.toClass(result.classContract),
      consent_required: result.user.status === 'pending_consent',
    };
  }

  private async createActivationToken(
    store: ActivationTokenStore,
    leadId: string,
    trialRequestId: string,
  ): Promise<string> {
    const raw = randomToken();
    await store.activationToken.create({
      data: {
        id: newId(),
        leadId,
        trialRequestId,
        tokenHash: sha256(raw),
        purpose: ACTIVATION_PURPOSE,
        expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS),
      },
    });
    return raw;
  }

  private toTrial(t: TrialPresenterInput) {
    const activation = this.activationPresentation(t);
    return {
      id: t.id,
      parent_profile_id: t.parentProfileId,
      lead_id: t.leadId,
      student_id: t.studentId,
      tutor_profile_id: t.tutorProfileId,
      subject: t.subject,
      grade: t.grade,
      learning_goal: t.learningGoal,
      teaching_mode: t.teachingMode,
      preferred_schedule: t.preferredSchedule,
      message: t.message,
      decline_reason: t.declineReason,
      status: t.status,
      version: t.version,
      created_at: t.createdAt.toISOString(),
      responded_at: t.respondedAt?.toISOString() ?? null,
      expires_at: t.expiresAt?.toISOString() ?? null,
      class_contract_id: t.classContract?.id ?? null,
      // Chính sách chia sẻ liên hệ đang là open question. API tutor fail-closed:
      // không parse/trả contact_snapshot hoặc Lead PII cho tới khi rule được chốt.
      contact: null,
      capabilities: {
        can_accept: t.status === 'pending',
        can_decline: t.status === 'pending',
        can_view_contact: false as const,
      },
      activation,
    };
  }

  private activationPresentation(t: TrialPresenterInput) {
    if (t.status !== 'accepted') {
      return { state: 'not_applicable' as const, expires_at: null };
    }
    const token = t.activationTokens?.[0];
    if (token?.consumedAt) {
      return { state: 'activated' as const, expires_at: token.expiresAt.toISOString() };
    }
    if (token && token.expiresAt.getTime() <= Date.now()) {
      return { state: 'expired' as const, expires_at: token.expiresAt.toISOString() };
    }
    if (token || t.leadId) {
      return {
        state: 'link_created' as const,
        expires_at: token?.expiresAt.toISOString() ?? null,
      };
    }
    return { state: 'not_required' as const, expires_at: null };
  }

  private throwTrialConflict(trial: TrialPresenterInput): never {
    throw new AppException(
      ErrorCode.CONFLICT,
      'Yêu cầu học thử vừa được xử lý bởi thao tác khác',
      { trial: this.toTrial(trial) },
    );
  }

  private createdAtCursorWhere(cursor?: string): Prisma.TrialRequestWhereInput {
    if (!cursor) return {};
    const decoded = decodeCursor(cursor);
    if (!decoded || typeof decoded[0] !== 'string') {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    const createdAt = new Date(decoded[0]);
    if (Number.isNaN(createdAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Cursor không hợp lệ');
    }
    return {
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: decoded[1] } },
      ],
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
}
