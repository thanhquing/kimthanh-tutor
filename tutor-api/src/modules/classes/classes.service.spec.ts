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

const relatedKlass = {
  ...klass,
  parentProfile: { id: klass.parentProfileId, displayName: "Anh Minh" },
  student: { id: klass.studentId, name: "Minh Châu", grade: "9" },
  trialRequest: {
    teachingMode: "online",
    preferredSchedule: "Thứ 2, 4 sau 19:00",
  },
};

const tutorUser = {
  userId: "user-1",
  roles: ["tutor" as const],
  status: "active",
  tutorProfileId: klass.tutorProfileId,
};

const parentUser = {
  userId: "parent-user",
  roles: ["parent" as const],
  status: "active",
  parentProfileId: klass.parentProfileId,
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
          ...relatedKlass,
          status: "active",
          version: 1,
          startedAt: now,
        }),
      },
    };
    const prisma = {
      classContract: { findFirst: jest.fn().mockResolvedValue(relatedKlass) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new ClassesService(prisma as any, outbox as any);

    const result = await service.transition(tutorUser, klass.id, {
      to: "active",
      expected_version: 0,
    });

    expect(tx.classContract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: klass.id,
          version: 0,
          status: "trial_accepted",
          tutorProfileId: klass.tutorProfileId,
        }),
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

  it("enforces the transition matrix per actor", async () => {
    const active = { ...relatedKlass, status: "active" };
    const prisma = {
      classContract: { findFirst: jest.fn().mockResolvedValue(active) },
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(
      service.transition(parentUser, klass.id, { to: "paused" }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });

  it("returns owner-safe detail with relation summary and tutor capabilities", async () => {
    const prisma = {
      classContract: { findFirst: jest.fn().mockResolvedValue(relatedKlass) },
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(service.detail(tutorUser, klass.id)).resolves.toMatchObject({
      id: klass.id,
      student: { name: "Minh Châu", grade: "9" },
      parent: { display_name: "Anh Minh" },
      requested_teaching_mode: "online",
      capabilities: {
        transitions: ["active", "cancelled"],
        can_create_lesson_log: false,
      },
    });
    expect(prisma.classContract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: klass.id,
          OR: [{ tutorProfileId: klass.tutorProfileId }],
        },
      }),
    );
  });

  it("fails closed when a class does not belong to the requester", async () => {
    const prisma = {
      classContract: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(service.detail(tutorUser, "foreign-class")).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it("returns current redacted class state for an expected-version conflict", async () => {
    const current = { ...relatedKlass, version: 2 };
    const prisma = {
      classContract: { findFirst: jest.fn().mockResolvedValue(current) },
    };
    const service = new ClassesService(prisma as any, {} as any);

    await expect(
      service.transition(tutorUser, klass.id, {
        to: "active",
        expected_version: 1,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      details: { class_contract: { id: klass.id, version: 2 } },
    });
  });

  it("lists tutor classes with keyset pagination and actor capabilities", async () => {
    const second = {
      ...relatedKlass,
      id: "01HYCLASS00000000000001",
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };
    const prisma = {
      classContract: { findMany: jest.fn().mockResolvedValue([second, relatedKlass]) },
    };
    const service = new ClassesService(prisma as any, {} as any);

    const result = await service.mine(tutorUser, { role: "tutor", limit: "1" });

    expect(result.items).toEqual([
      expect.objectContaining({ id: second.id, capabilities: expect.any(Object) }),
    ]);
    expect(result.next_cursor).toBe(
      encodeCursor(second.updatedAt.toISOString(), second.id),
    );
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
