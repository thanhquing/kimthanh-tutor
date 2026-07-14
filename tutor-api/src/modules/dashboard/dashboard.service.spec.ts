import { DashboardService } from './dashboard.service';

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
