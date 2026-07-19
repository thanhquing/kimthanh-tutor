import { DashboardService } from './dashboard.service';
import { ErrorCode } from '../../common/errors/error-codes';

const now = new Date('2026-01-01T00:00:00Z');
const parent = { id: 'parent-1' };
const student = {
  id: 'student-1',
  parentProfileId: parent.id,
  name: 'Be Na',
  grade: '8',
  learningGoals: 'Math confidence',
  status: 'active',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};
const klass = {
  id: 'class-1',
  subject: 'math',
  status: 'active',
  startedAt: now,
  endedAt: null,
  updatedAt: now,
  tutorProfile: { id: 'tutor-1', displayName: 'Co Linh', avatarMediaId: null },
  _count: { lessonLogs: 2 },
};
const lesson = {
  id: 'lesson-1',
  classContractId: klass.id,
  tutorProfileId: 'tutor-1',
  lessonAt: now,
  subject: 'math',
  content: 'Fractions',
  homework: 'Worksheet',
  absorptionLevel: 'good',
  tutorNote: 'Doing well',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  classContract: { id: klass.id, subject: 'math' },
};

describe('DashboardService', () => {
  it('returns a bounded owner-safe tutor overview with truthful capabilities', async () => {
    const subscription = {
      id: 'sub-1',
      userId: 'user-1',
      type: 'tutor_qr',
      scopeRefId: null,
      paymentId: 'payment-1',
      status: 'active',
      autoRenew: false,
      startsAt: now,
      currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      cancelledAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tutor-1',
          displayName: 'Cô Linh',
          status: 'published',
          moderationStatus: 'approved',
          _count: { payoutAccounts: 1 },
        }),
      },
      trialRequest: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trial-1',
            subject: 'math',
            grade: '8',
            teachingMode: 'online',
            createdAt: now,
          },
        ]),
      },
      classContract: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'class-1',
            subject: 'math',
            status: 'active',
            updatedAt: now,
          },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'lesson-1',
          classContractId: 'class-1',
          lessonAt: now,
          subject: 'fractions',
        },
      ]),
      tutorPaymentQrRecord: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'qr-1',
            classContractId: 'class-1',
            amount: 800_000n,
            collectionStatus: 'created',
            createdAt: now,
          },
        ]),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue(subscription) },
    };
    const access = { hasTutorQrAccess: jest.fn().mockResolvedValue(true) };
    const service = new DashboardService(prisma as any, access as any);

    const result = await service.tutorOverview('user-1');

    expect(result).toMatchObject({
      profile: { id: 'tutor-1', display_name: 'Cô Linh', status: 'published' },
      summary: { pending_trials: 1, teaching_classes: 1, pending_qr_records: 1 },
      pending_trials: [{ id: 'trial-1', grade: 8, teaching_mode: 'online' }],
      teaching_classes: [
        {
          id: 'class-1',
          can_create_lesson_log: true,
          latest_lesson: { id: 'lesson-1', subject: 'fractions' },
        },
      ],
      pending_qr_records: [{ id: 'qr-1', amount: 800000 }],
      qr_subscription: { id: 'sub-1', status: 'active' },
      capabilities: {
        has_payout_account: true,
        has_active_qr_access: true,
        can_create_qr: true,
      },
      partial_errors: [],
    });
    expect(prisma.trialRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
    expect(prisma.classContract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    );
    expect(access.hasTutorQrAccess).toHaveBeenCalledWith('user-1');
  });

  it('isolates a failed tutor widget without discarding successful sections', async () => {
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tutor-1',
          displayName: 'Cô Linh',
          status: 'draft',
          moderationStatus: 'pending',
          _count: { payoutAccounts: 0 },
        }),
      },
      trialRequest: {
        count: jest.fn().mockRejectedValue(new Error('temporary failure')),
        findMany: jest.fn().mockResolvedValue([]),
      },
      classContract: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn(),
      tutorPaymentQrRecord: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const access = { hasTutorQrAccess: jest.fn().mockResolvedValue(false) };
    const service = new DashboardService(prisma as any, access as any);

    const result = await service.tutorOverview('user-1');

    expect(result.pending_trials).toEqual([]);
    expect(result.teaching_classes).toEqual([]);
    expect(result.pending_qr_records).toEqual([]);
    expect(result.partial_errors).toEqual(['pending_trials']);
    expect(result.capabilities.can_create_qr).toBe(false);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('fails closed when the tutor profile does not belong to the user', async () => {
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      trialRequest: { count: jest.fn() },
    };
    const service = new DashboardService(prisma as any, {} as any);

    await expect(service.tutorOverview('user-1')).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN_ROLE,
    });
    expect(prisma.trialRequest.count).not.toHaveBeenCalled();
  });

  it('returns parent-owned student overview without requiring tracking subscription', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parent) },
      student: { findFirst: jest.fn().mockResolvedValue(student) },
      classContract: { findMany: jest.fn().mockResolvedValue([klass]) },
      lessonLog: { findFirst: jest.fn().mockResolvedValue(lesson) },
    };
    const service = new DashboardService(prisma as any, {} as any);

    const result = await service.studentOverview('user-1', student.id);

    expect(result).toMatchObject({
      student: { id: student.id, name: student.name },
      summary: {
        total_classes: 1,
        active_classes: 1,
        total_lesson_logs: 2,
      },
      latest_lesson: {
        subject: 'math',
        absorption_level: 'good',
      },
      classes: [{ id: klass.id, tutor: { display_name: 'Co Linh' } }],
    });
  });

  it('requires tracking subscription for detailed timeline and returns growth counts', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parent) },
      student: { findFirst: jest.fn().mockResolvedValue(student) },
      lessonLog: {
        findMany: jest.fn().mockResolvedValue([lesson]),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ absorptionLevel: 'good', _count: { absorptionLevel: 3 } }]),
      },
    };
    const access = { assertTracking: jest.fn().mockResolvedValue(undefined) };
    const service = new DashboardService(prisma as any, access as any);

    const result = await service.studentDetail('user-1', student.id, { limit: '20' });

    expect(access.assertTracking).toHaveBeenCalledWith('user-1', student.id);
    expect(result.growth).toEqual({ good: 3 });
    expect(result.timeline.items).toEqual([
      expect.objectContaining({
        id: lesson.id,
        subject: lesson.subject,
        absorption_level: 'good',
      }),
    ]);
  });
});
