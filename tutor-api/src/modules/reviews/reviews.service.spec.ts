import { ReviewsService } from "./reviews.service";
import { ErrorCode } from "../../common/errors/error-codes";

const now = new Date("2026-01-01T00:00:00Z");
const parent = { id: "parent-1" };
const klass = {
  id: "class-1",
  parentProfileId: parent.id,
  studentId: "student-1",
  tutorProfileId: "tutor-1",
  subject: "math",
  status: "completed_pending_review",
  version: 0,
  startedAt: now,
  endedAt: null,
  createdAt: now,
  updatedAt: now,
  review: null,
};
const review = {
  id: "review-1",
  classContractId: klass.id,
  parentProfileId: parent.id,
  tutorProfileId: klass.tutorProfileId,
  rating: 5,
  comment: "Great",
  status: "published",
  editableUntil: new Date("2026-01-08T00:00:00Z"),
  createdAt: now,
  updatedAt: now,
};

describe("ReviewsService", () => {
  it("returns review capability state for a class before review is created", async () => {
    const prisma = {
      classContract: {
        findFirst: jest.fn().mockResolvedValue(klass),
      },
    };
    const service = new ReviewsService(prisma as any, {} as any);

    const result = await service.getForClass(
      {
        userId: "parent-user",
        roles: ["parent"],
        status: "active",
        parentProfileId: parent.id,
      },
      klass.id,
    );

    expect(prisma.classContract.findFirst).toHaveBeenCalledWith({
      where: { id: klass.id, OR: [{ parentProfileId: parent.id }] },
      include: { review: true },
    });
    expect(result).toEqual({
      class_id: klass.id,
      review: null,
      can_create: true,
      can_edit: false,
      can_report: false,
    });
  });

  it("returns review details and edit/report capabilities for class participants", async () => {
    const editableReview = {
      ...review,
      editableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const prisma = {
      classContract: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...klass, review: editableReview }),
      },
    };
    const service = new ReviewsService(prisma as any, {} as any);

    const parentResult = await service.getForClass(
      {
        userId: "parent-user",
        roles: ["parent"],
        status: "active",
        parentProfileId: parent.id,
      },
      klass.id,
    );
    const tutorResult = await service.getForClass(
      {
        userId: "tutor-user",
        roles: ["tutor"],
        status: "active",
        tutorProfileId: klass.tutorProfileId,
      },
      klass.id,
    );

    expect(parentResult).toMatchObject({
      class_id: klass.id,
      review: { id: review.id, rating: 5, status: "published" },
      can_create: false,
      can_edit: true,
      can_report: false,
    });
    expect(tutorResult).toMatchObject({
      class_id: klass.id,
      review: { id: review.id, rating: 5, status: "published" },
      can_create: false,
      can_edit: false,
      can_report: true,
    });
  });

  it("creates a published review, completes class, and recomputes tutor rating", async () => {
    const tx = {
      review: {
        create: jest.fn().mockResolvedValue(review),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } }),
      },
      classContract: { update: jest.fn() },
      tutorProfile: { update: jest.fn() },
    };
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parent) },
      classContract: { findFirst: jest.fn().mockResolvedValue(klass) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new ReviewsService(prisma as any, outbox as any);

    const result = await service.create("user-1", klass.id, {
      rating: 5,
      comment: "Great",
    });

    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classContractId: klass.id,
          parentProfileId: parent.id,
          tutorProfileId: klass.tutorProfileId,
          status: "published",
        }),
      }),
    );
    expect(tx.tutorProfile.update).toHaveBeenCalledWith({
      where: { id: klass.tutorProfileId },
      data: { ratingAvg: 4.5, ratingCount: 2 },
    });
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "review.created" }),
    );
    expect(result).toMatchObject({
      id: review.id,
      status: "published",
      rating: 5,
    });
  });

  it("rejects editing a review after editable_until", async () => {
    const prisma = {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parent) },
      review: {
        findFirst: jest.fn().mockResolvedValue({
          ...review,
          editableUntil: new Date("2020-01-01T00:00:00Z"),
        }),
      },
    };
    const service = new ReviewsService(prisma as any, {} as any);

    await expect(
      service.update("user-1", review.id, { rating: 4, comment: "Updated" }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });

  it("lets the owning tutor report a review", async () => {
    const tx = {
      review: {
        update: jest.fn().mockResolvedValue({ ...review, status: "disputed" }),
      },
    };
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: klass.tutorProfileId }),
      },
      review: { findFirst: jest.fn().mockResolvedValue(review) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new ReviewsService(prisma as any, outbox as any);

    const result = await service.report("tutor-user", review.id, {
      reason: "Spam",
    });

    expect(tx.review.update).toHaveBeenCalledWith({
      where: { id: review.id },
      data: { status: "disputed" },
    });
    expect(result.status).toBe("disputed");
  });
});
