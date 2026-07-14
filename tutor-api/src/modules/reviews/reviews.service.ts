import { Injectable } from "@nestjs/common";
import { Review } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppException } from "../../common/errors/app.exception";
import { ErrorCode } from "../../common/errors/error-codes";
import { newId } from "../../common/utils/id.util";
import { OutboxService } from "../../common/shared/outbox.service";
import { AuthUser } from "../../common/auth/auth-user";
import { ReportReviewDto, ReviewDto } from "./dto/review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async getForClass(user: AuthUser, classId: string) {
    const OR = [];
    if (user.parentProfileId)
      OR.push({ parentProfileId: user.parentProfileId });
    if (user.tutorProfileId) OR.push({ tutorProfileId: user.tutorProfileId });
    if (OR.length === 0) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, "Không thuộc lớp");
    }

    const klass = await this.prisma.classContract.findFirst({
      where: { id: classId, OR },
      include: { review: true },
    });
    if (!klass) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy lớp",
      );
    }

    const review = klass.review ? this.toReview(klass.review) : null;
    const isParent = user.parentProfileId === klass.parentProfileId;
    const isTutor = user.tutorProfileId === klass.tutorProfileId;
    const editable =
      !!klass.review?.editableUntil &&
      klass.review.editableUntil.getTime() >= Date.now() &&
      klass.review.status !== "hidden";

    return {
      class_id: klass.id,
      review,
      can_create:
        isParent &&
        !klass.review &&
        ["completed_pending_review", "completed"].includes(klass.status),
      can_edit: isParent && !!klass.review && editable,
      can_report:
        isTutor && !!klass.review && klass.review.status === "published",
    };
  }

  async create(userId: string, classId: string, dto: ReviewDto) {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!parent) {
      throw new AppException(
        ErrorCode.FORBIDDEN_ROLE,
        "Chưa có hồ sơ phụ huynh",
      );
    }
    const klass = await this.prisma.classContract.findFirst({
      where: {
        id: classId,
        parentProfileId: parent.id,
        status: { in: ["completed_pending_review", "completed"] },
      },
      include: { review: true },
    });
    if (!klass) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy lớp đủ điều kiện đánh giá",
      );
    }
    if (klass.review) {
      throw new AppException(ErrorCode.CONFLICT, "Lớp đã có đánh giá");
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          id: newId(),
          classContractId: klass.id,
          parentProfileId: parent.id,
          tutorProfileId: klass.tutorProfileId,
          rating: dto.rating,
          comment: dto.comment?.trim() ?? null,
          status: "published",
          editableUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.classContract.update({
        where: { id: klass.id },
        data: {
          status: "completed",
          version: { increment: 1 },
          endedAt: klass.endedAt ?? new Date(),
        },
      });
      await this.recomputeTutorRating(tx, klass.tutorProfileId);
      await this.outbox.emit(tx, {
        aggregateType: "review",
        aggregateId: created.id,
        eventType: "review.created",
        payload: {
          review_id: created.id,
          class_contract_id: klass.id,
          tutor_profile_id: klass.tutorProfileId,
        },
      });
      return created;
    });
    return this.toReview(review);
  }

  async update(userId: string, id: string, dto: ReviewDto) {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!parent) {
      throw new AppException(
        ErrorCode.FORBIDDEN_ROLE,
        "Chưa có hồ sơ phụ huynh",
      );
    }
    const review = await this.prisma.review.findFirst({
      where: { id, parentProfileId: parent.id },
    });
    if (!review) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy đánh giá",
      );
    }
    if (review.editableUntil && review.editableUntil.getTime() < Date.now()) {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        "Đã hết thời hạn chỉnh sửa đánh giá",
      );
    }
    if (review.status === "hidden") {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        "Đánh giá đã bị ẩn không thể chỉnh sửa",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reviewEdit.create({
        data: {
          id: newId(),
          reviewId: review.id,
          oldRating: review.rating,
          oldComment: review.comment,
          editedBy: userId,
        },
      });
      const next = await tx.review.update({
        where: { id: review.id },
        data: {
          rating: dto.rating,
          comment: dto.comment?.trim() ?? null,
          status:
            review.status === "disputed" ? "pending_moderation" : review.status,
        },
      });
      await this.recomputeTutorRating(tx, review.tutorProfileId);
      return next;
    });
    return this.toReview(updated);
  }

  async report(userId: string, id: string, dto: ReportReviewDto) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tutor) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, "Chưa có hồ sơ gia sư");
    }
    const review = await this.prisma.review.findFirst({
      where: { id, tutorProfileId: tutor.id },
    });
    if (!review) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy đánh giá",
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id: review.id },
        data: { status: "disputed" },
      });
      await this.outbox.emit(tx, {
        aggregateType: "review",
        aggregateId: review.id,
        eventType: "review.reported",
        payload: { review_id: review.id, reason: dto.reason },
      });
      return next;
    });
    return { status: updated.status, review: this.toReview(updated) };
  }

  private async recomputeTutorRating(
    tx: { review: any; tutorProfile: any },
    tutorProfileId: string,
  ): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { tutorProfileId, status: "published" },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.tutorProfile.update({
      where: { id: tutorProfileId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });
  }

  private toReview(r: Review) {
    return {
      id: r.id,
      class_contract_id: r.classContractId,
      parent_profile_id: r.parentProfileId,
      tutor_profile_id: r.tutorProfileId,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      editable_until: r.editableUntil?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    };
  }
}
