import { Injectable } from '@nestjs/common';
import { TrialRequest, ClassContract, Lead, Prisma } from '@prisma/client';
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
  TrialMineQueryDto,
} from './dto/trial.dto';

const ACTIVATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ACTIVATION_PURPOSE = 'guest_trial_activation';
type ActivationTokenStore = Pick<Prisma.TransactionClient, 'activationToken'>;

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
        ? [query.role]
        : (['parent', 'tutor'] as const).filter((r) => user.roles.includes(r));
    const OR = [];
    if (roles.includes('parent') && user.parentProfileId) {
      OR.push({ parentProfileId: user.parentProfileId });
    }
    if (roles.includes('tutor') && user.tutorProfileId) {
      OR.push({ tutorProfileId: user.tutorProfileId });
    }
    if (OR.length === 0) return { items: [] };

    const items = await this.prisma.trialRequest.findMany({
      where: { OR },
      include: { classContract: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return { items: items.map((t) => this.toTrial(t)) };
  }

  async accept(user: AuthUser, id: string) {
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
    if (trial.classContract) {
      const activationToken = trial.leadId
        ? await this.createActivationToken(
            this.prisma,
            trial.leadId,
            trial.id,
          )
        : null;
      return {
        trial: this.toTrial(trial),
        class_contract: this.toClass(trial.classContract),
        activation_token: activationToken,
      };
    }
    if (trial.status !== 'pending') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Chỉ yêu cầu pending mới được chấp nhận',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.trialRequest.updateMany({
        where: { id: trial.id, version: trial.version, status: 'pending' },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AppException(
          ErrorCode.CONFLICT,
          'Yêu cầu học thử vừa được xử lý bởi thao tác khác',
        );
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
    if (trial.status !== 'pending') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Chỉ yêu cầu pending mới được từ chối',
      );
    }
    const updated = await this.prisma.trialRequest.update({
      where: { id },
      data: {
        status: 'declined',
        respondedAt: new Date(),
        message: dto.reason ? `${trial.message ?? ''}\n[decline] ${dto.reason}` : trial.message,
        version: { increment: 1 },
      },
    });
    return this.toTrial(updated);
  }

  async cancel(user: AuthUser, id: string) {
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
    if (trial.status !== 'pending') {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Chỉ yêu cầu pending mới được hủy',
      );
    }
    const updated = await this.prisma.trialRequest.update({
      where: { id },
      data: { status: 'cancelled', respondedAt: new Date(), version: { increment: 1 } },
    });
    return this.toTrial(updated);
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

  private toTrial(
    t: TrialRequest & { classContract?: ClassContract | null; lead?: Lead | null },
  ) {
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
      status: t.status,
      version: t.version,
      created_at: t.createdAt.toISOString(),
      responded_at: t.respondedAt?.toISOString() ?? null,
      expires_at: t.expiresAt?.toISOString() ?? null,
      class_contract_id: t.classContract?.id ?? null,
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
