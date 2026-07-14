import { ParentsService } from './parents.service';
import { ErrorCode } from '../../common/errors/error-codes';

const now = new Date('2026-01-01T00:00:00Z');
const parentProfile = {
  id: 'parent-1',
  userId: 'user-1',
  displayName: 'Parent One',
  status: 'active',
  createdAt: now,
};
const student = {
  id: 'student-1',
  parentProfileId: parentProfile.id,
  name: 'Minh',
  grade: '6',
  learningGoals: 'Math',
  status: 'active',
  createdAt: now,
};

describe('ParentsService', () => {
  it('bootstraps a parent profile, grants parent role, and stores email', async () => {
    const user = { id: 'user-1', phone: '0900000000', roles: [] };
    const tx = {
      parentProfile: {
        create: jest.fn().mockResolvedValue(parentProfile),
      },
      user: {
        update: jest.fn(),
      },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      parentProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new ParentsService(prisma as any);

    const result = await service.bootstrap('user-1', {
      display_name: 'Parent One',
      email: 'parent@example.test',
    });

    expect(tx.parentProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        displayName: 'Parent One',
      }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { roles: { set: ['parent'] } },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { email: 'parent@example.test' },
    });
    expect(result).toMatchObject({
      id: 'parent-1',
      display_name: 'Parent One',
      email: 'parent@example.test',
      created_at: now.toISOString(),
    });
  });

  it('adds a student under the authenticated parent profile', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
      student: { create: jest.fn().mockResolvedValue(student) },
    };
    const service = new ParentsService(prisma as any);

    const result = await service.addStudent('user-1', {
      name: ' Minh ',
      grade: ' 6 ',
      learning_goals: 'Math',
    });

    expect(prisma.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentProfileId: 'parent-1',
        name: 'Minh',
        grade: '6',
        learningGoals: 'Math',
      }),
    });
    expect(result).toMatchObject({
      id: 'student-1',
      name: 'Minh',
      grade: '6',
      learning_goals: 'Math',
    });
  });

  it('rejects blank student fields after trimming', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
      student: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    };
    const service = new ParentsService(prisma as any);

    await expect(
      service.addStudent('user-1', { name: '   ', grade: '6' }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { field: 'name' },
    });
    expect(prisma.student.create).not.toHaveBeenCalled();
  });

  it('enforces ownership when updating a student', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
      student: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new ParentsService(prisma as any);

    await expect(
      service.updateStudent('user-1', 'student-2', { name: 'Other' }),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-2', parentProfileId: 'parent-1' },
      select: { id: true },
    });
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  it('rejects blank parent display name on explicit update', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
      $transaction: jest.fn(),
    };
    const service = new ParentsService(prisma as any);

    await expect(
      service.updateMe('user-1', { display_name: '   ' }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { field: 'display_name' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('soft deletes an owned student', async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
      student: {
        findFirst: jest.fn().mockResolvedValue({ id: 'student-1' }),
        update: jest.fn().mockResolvedValue({ ...student, deletedAt: now }),
      },
    };
    const service = new ParentsService(prisma as any);

    await expect(service.removeStudent('user-1', 'student-1')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
