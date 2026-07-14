import { ClassesService } from "./classes.service";
import { ErrorCode } from "../../common/errors/error-codes";
import { encodeCursor } from "../../common/pagination/keyset";

const now = new Date("2026-01-01T00:00:00Z");

const klass = {
  id: "01HYCLASS00000000000000",
  trialRequestId: "01HYTRIAL00000000000000",
  parentProfileId: "01HYPARENT000000000000",
  studentId: "01HYSTUDENT000000000000",
  tutorProfileId: "01HYTUTOR00000000000000",
  subject: "math",
  status: "trial_accepted",
  version: 0,
  startedAt: null,
  endedAt: null,
  createdAt: now,
  updatedAt: now,
};

const lessonLog = {
  id: "01HYLOG0000000000000000",
  classContractId: klass.id,
  tutorProfileId: klass.tutorProfileId,
  lessonAt: now,
  subject: "math",
  content: "Linear equations",
  homework: "Practice set A",
  absorptionLevel: "normal",
  tutorNote: "Needs repetition",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe("ClassesService", () => {
  it("transitions class state with optimistic locking", async () => {
    const tx = {
      classContract: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...klass,
          status: "active",
          version: 1,
          startedAt: now,
        }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          parentProfile: null,
          tutorProfile: { id: klass.tutorProfileId },
        }),
      },
      classContract: { findFirst: jest.fn().mockResolvedValue(klass) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new ClassesService(prisma as any, outbox as any);

    const result = await service.transition("user-1", klass.id, {
      to: "active",
    });

    expect(tx.classContract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: klass.id, version: 0, status: "trial_accepted" },
        data: expect.objectContaining({ status: "active" }),
      }),
    );
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "class.transitioned" }),
    );
    expect(result).toMatchObject({
      id: klass.id,
      status: "active",
      version: 1,
    });
  });

  it("rejects invalid class transitions", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          parentProfile: { id: klass.parentProfileId },
          tutorProfile: null,
        }),
      },
      classContract: { findFirst: jest.fn().mockResolvedValue(klass) },
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(
      service.transition("user-1", klass.id, { to: "completed" }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });

  it("creates a lesson log for the tutor class and emits an event", async () => {
    const activeClass = { ...klass, status: "active" };
    const tx = {
      lessonLog: { create: jest.fn().mockResolvedValue(lessonLog) },
    };
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: klass.tutorProfileId }),
      },
      classContract: { findFirst: jest.fn().mockResolvedValue(activeClass) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new ClassesService(prisma as any, outbox as any);

    const result = await service.createLessonLog("user-1", klass.id, {
      lesson_at: now,
      subject: "math",
      content: "Linear equations",
      homework: "Practice set A",
      absorption_level: "normal",
      tutor_note: "Needs repetition",
    });

    expect(tx.lessonLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classContractId: klass.id,
          tutorProfileId: klass.tutorProfileId,
          absorptionLevel: "normal",
        }),
      }),
    );
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "lesson_log.created" }),
    );
    expect(result).toMatchObject({
      id: lessonLog.id,
      class_contract_id: klass.id,
      subject: "math",
    });
  });

  it("lists tutor lesson logs with keyset pagination", async () => {
    const secondLog = {
      ...lessonLog,
      id: "01HYLOG0000000000000001",
      lessonAt: new Date("2026-01-02T00:00:00Z"),
    };
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: klass.tutorProfileId }),
      },
      classContract: { findFirst: jest.fn().mockResolvedValue(klass) },
      lessonLog: {
        findMany: jest.fn().mockResolvedValue([secondLog, lessonLog]),
      },
    };
    const service = new ClassesService(prisma as any, {} as any);

    const result = await service.listLessonLogs("user-1", klass.id, {
      limit: "1",
    });

    expect(prisma.lessonLog.findMany).toHaveBeenCalledWith({
      where: {
        classContractId: klass.id,
        tutorProfileId: klass.tutorProfileId,
        deletedAt: null,
      },
      orderBy: [{ lessonAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: secondLog.id,
          class_contract_id: klass.id,
          lesson_at: secondLog.lessonAt.toISOString(),
        }),
      ],
      next_cursor: encodeCursor(secondLog.lessonAt.toISOString(), secondLog.id),
    });
  });

  it("rejects invalid lesson log cursors", async () => {
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: klass.tutorProfileId }),
      },
      classContract: { findFirst: jest.fn().mockResolvedValue(klass) },
      lessonLog: { findMany: jest.fn() },
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(
      service.listLessonLogs("user-1", klass.id, { cursor: "not-base64-json" }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(prisma.lessonLog.findMany).not.toHaveBeenCalled();
  });

  it("rejects blank lesson log subject after trimming", async () => {
    const activeClass = { ...klass, status: "active" };
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: klass.tutorProfileId }),
      },
      classContract: { findFirst: jest.fn().mockResolvedValue(activeClass) },
      $transaction: jest.fn(),
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(
      service.createLessonLog("user-1", klass.id, {
        lesson_at: now,
        subject: "   ",
        absorption_level: "normal",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { field: "subject" },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
