import { Injectable } from "@nestjs/common";
import {
  AuditLog,
  MediaAsset,
  PaidFeature,
  PaidFeatureOverride,
  Payment,
  PlatformPaymentAccount,
  Prisma,
  ProductPricing,
  ProductType,
  Review,
  Subscription,
  TutorProfile,
  User,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppException } from "../../common/errors/app.exception";
import { ErrorCode } from "../../common/errors/error-codes";
import { newId } from "../../common/utils/id.util";
import { AuditService } from "../../common/shared/audit.service";
import {
  AdminAuditLogsQueryDto,
  AdminOverviewQueryDto,
  AdminPaymentsQueryDto,
  AdminSystemLogsQueryDto,
  AdminUsersQueryDto,
  AdminUserStatusDto,
  ModerateMediaDto,
  ModerateReviewDto,
  PaidFeatureOverrideDto,
  PlatformPaymentAccountDto,
  PricingDto,
  RefundDto,
  TutorStatusDto,
} from "./dto/admin.dto";
import {
  buildKeyset,
  clampLimit,
  decodeCursor,
  encodeCursor,
} from "../../common/pagination/keyset";

type CheckoutProduct = "single_unlock" | "parent_vip" | "parent_tracking" | "tutor_qr";

const DEFAULT_PRICING: Record<CheckoutProduct, { amount: bigint; periodDays: number | null }> = {
  single_unlock: { amount: 49_000n, periodDays: null },
  parent_vip: { amount: 150_000n, periodDays: 30 },
  parent_tracking: { amount: 69_000n, periodDays: 30 },
  tutor_qr: { amount: 30_000n, periodDays: 30 },
};

const PRODUCT_TYPES = Object.keys(DEFAULT_PRICING) as CheckoutProduct[];
const PAID_FEATURES: PaidFeature[] = [
  "single_unlock",
  "parent_vip",
  "parent_tracking",
  "tutor_qr",
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async overview(query: AdminOverviewQueryDto) {
    const range = this.dateRange(query.from, query.to);
    const userWhere: Prisma.UserWhereInput = range ? { createdAt: range } : {};
    const paymentWhere: Prisma.PaymentWhereInput = range
      ? { createdAt: range }
      : {};

    const [
      users,
      total,
      active,
      pendingConsent,
      suspended,
      tutorsPending,
      reviewsPending,
      mediaPending,
      paidPayments,
      pendingPayments,
      paidAmount,
      activeOverrides,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        select: { createdAt: true, roles: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.user.count({ where: userWhere }),
      this.prisma.user.count({ where: { ...userWhere, status: "active" } }),
      this.prisma.user.count({
        where: { ...userWhere, status: "pending_consent" },
      }),
      this.prisma.user.count({ where: { ...userWhere, status: "suspended" } }),
      this.prisma.tutorProfile.count({ where: { moderationStatus: "pending" } }),
      this.prisma.review.count({
        where: { status: { in: ["pending_moderation", "disputed"] } },
      }),
      this.prisma.mediaAsset.count({ where: { moderationStatus: "pending" } }),
      this.prisma.payment.count({ where: { ...paymentWhere, status: "paid" } }),
      this.prisma.payment.count({
        where: { ...paymentWhere, status: "pending" },
      }),
      this.prisma.payment.aggregate({
        where: { ...paymentWhere, status: "paid" },
        _sum: { amount: true },
      }),
      this.prisma.paidFeatureOverride.count({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    ]);

    return {
      users: {
        total,
        active,
        pending_consent: pendingConsent,
        suspended,
        by_role: this.countRoles(users),
      },
      registrations_by_day: this.registrationsByDay(users),
      moderation: {
        tutors_pending: tutorsPending,
        reviews_pending: reviewsPending,
        media_pending: mediaPending,
      },
      payments: {
        paid_count: paidPayments,
        paid_amount: Number(paidAmount._sum.amount ?? 0n),
        pending_count: pendingPayments,
      },
      paid_features: {
        active_overrides: activeOverrides,
      },
    };
  }

  async listUsers(query: AdminUsersQueryDto) {
    const limit = clampLimit(query.limit);
    const where = this.userWhere(query);
    const rows = await this.prisma.user.findMany({
      where,
      include: {
        parentProfile: { select: { id: true, status: true, displayName: true } },
        tutorProfile: {
          select: {
            id: true,
            status: true,
            moderationStatus: true,
            displayName: true,
          },
        },
        subscriptions: {
          where: { status: "active" },
          select: { type: true, scopeRefId: true, currentPeriodEnd: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
        },
        paidFeatureOverrides: {
          select: { feature: true, enabled: true, expiresAt: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (u) =>
      encodeCursor(u.createdAt.toISOString(), u.id),
    );
    return {
      items: page.items.map((u) => this.toUserCard(u)),
      next_cursor: page.next_cursor,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        parentProfile: true,
        tutorProfile: true,
        subscriptions: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
        },
        payments: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
        },
        paidFeatureOverrides: true,
      },
    });
    if (!user) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy user");
    }
    const paidAmount = user.payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0n);
    return {
      user: this.toUserBase(user),
      profiles: {
        parent: user.parentProfile
          ? {
              id: user.parentProfile.id,
              display_name: user.parentProfile.displayName,
              status: user.parentProfile.status,
            }
          : null,
        tutor: user.tutorProfile ? this.toTutor(user.tutorProfile) : null,
      },
      subscriptions: user.subscriptions.map((s) => this.toSubscription(s)),
      payments_summary: {
        total_count: user.payments.length,
        paid_count: user.payments.filter((p) => p.status === "paid").length,
        paid_amount: Number(paidAmount),
      },
      feature_overrides: user.paidFeatureOverrides.map((o) =>
        this.toPaidFeatureOverride(o),
      ),
    };
  }

  async setUserStatus(
    actorUserId: string,
    id: string,
    dto: AdminUserStatusDto,
  ) {
    if (actorUserId === id && dto.status === "suspended") {
      throw new AppException(
        ErrorCode.CONFLICT,
        "Admin không được tự khóa chính mình",
      );
    }
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy user");
    }
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: dto.status },
      });
      if (dto.status === "suspended") {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: "admin.user_status",
        entityType: "user",
        entityId: id,
        before,
        after: { user: updated, reason: dto.reason },
      });
      return updated;
    });
    return this.toUserBase(after);
  }

  async systemLogs(query: AdminSystemLogsQueryDto) {
    if (query.type === "audit") return this.systemAuditLogs(query);
    if (query.type === "webhook") return this.systemWebhookLogs(query);
    return this.systemOutboxLogs(query);
  }

  async getPlatformPaymentAccount() {
    const account = await this.prisma.platformPaymentAccount.findFirst({
      where: { isActive: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    if (!account) {
      return {
        bank_code: null,
        account_number_masked: null,
        account_holder: null,
        is_active: false,
        updated_at: null,
      };
    }
    return this.toPlatformPaymentAccount(account);
  }

  async setPlatformPaymentAccount(
    actorUserId: string,
    dto: PlatformPaymentAccountDto,
  ) {
    const existing = await this.prisma.platformPaymentAccount.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.is_active) {
        await tx.platformPaymentAccount.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }
      const saved = existing
        ? await tx.platformPaymentAccount.update({
            where: { id: existing.id },
            data: {
              bankCode: dto.bank_code.trim().toUpperCase(),
              accountNumber: dto.account_number.trim(),
              accountHolder: dto.account_holder.trim(),
              isActive: dto.is_active,
            },
          })
        : await tx.platformPaymentAccount.create({
            data: {
              id: newId(),
              bankCode: dto.bank_code.trim().toUpperCase(),
              accountNumber: dto.account_number.trim(),
              accountHolder: dto.account_holder.trim(),
              isActive: dto.is_active,
            },
          });
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: "admin.platform_payment_account",
        entityType: "platform_payment_account",
        entityId: saved.id,
        before: existing ? this.safePlatformAccount(existing) : null,
        after: this.safePlatformAccount(saved),
      });
      return saved;
    });
    return this.toPlatformPaymentAccount(account);
  }

  async listPricing() {
    const rows = await this.prisma.productPricing.findMany({
      orderBy: [{ productType: "asc" }],
    });
    const byType = new Map(rows.map((p) => [p.productType, p]));
    return {
      items: PRODUCT_TYPES.map((type) =>
        this.toPricing(byType.get(type) ?? this.defaultPricingRow(type)),
      ),
    };
  }

  async setPricing(actorUserId: string, rawProductType: string, dto: PricingDto) {
    const productType = this.parseProductType(rawProductType);
    const before = await this.prisma.productPricing.findUnique({
      where: { productType },
    });
    const pricing = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.productPricing.upsert({
        where: { productType },
        create: {
          id: newId(),
          productType,
          amount: BigInt(dto.amount),
          periodDays:
            productType === "single_unlock" ? null : (dto.period_days ?? 30),
          isEnabled: dto.is_enabled,
        },
        update: {
          amount: BigInt(dto.amount),
          periodDays:
            productType === "single_unlock" ? null : (dto.period_days ?? 30),
          isEnabled: dto.is_enabled,
        },
      });
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: "admin.pricing",
        entityType: "product_pricing",
        entityId: saved.id,
        before,
        after: { pricing: saved, reason: dto.reason },
      });
      return saved;
    });
    return this.toPricing(pricing);
  }

  async getPaidFeatures(userId: string) {
    await this.assertUserExists(userId);
    const [overrides, subscriptions, unlocks] = await Promise.all([
      this.prisma.paidFeatureOverride.findMany({
        where: { userId },
        orderBy: [{ feature: "asc" }],
      }),
      this.prisma.subscription.findMany({
        where: { userId, status: "active" },
      }),
      this.prisma.profileUnlock.count({
        where: {
          parentProfile: { userId },
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    ]);
    const byFeature = new Map(overrides.map((o) => [o.feature, o]));
    return {
      items: PAID_FEATURES.map((feature) => {
        const override = byFeature.get(feature);
        return {
          feature,
          entitlement_state: this.entitlementState(
            feature,
            subscriptions,
            unlocks,
          ),
          override: override ? this.toPaidFeatureOverride(override) : null,
        };
      }),
    };
  }

  async setPaidFeature(
    actorUserId: string,
    userId: string,
    rawFeature: string,
    dto: PaidFeatureOverrideDto,
  ) {
    const feature = this.parsePaidFeature(rawFeature);
    await this.assertUserExists(userId);
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        "expires_at phải nằm trong tương lai",
      );
    }
    const before = await this.prisma.paidFeatureOverride.findUnique({
      where: { userId_feature: { userId, feature } },
    });
    const override = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.paidFeatureOverride.upsert({
        where: { userId_feature: { userId, feature } },
        create: {
          id: newId(),
          userId,
          feature,
          enabled: dto.enabled,
          reason: dto.reason,
          expiresAt,
        },
        update: {
          enabled: dto.enabled,
          reason: dto.reason,
          expiresAt,
        },
      });
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: "admin.paid_feature_override",
        entityType: "paid_feature_override",
        entityId: saved.id,
        before,
        after: saved,
      });
      return saved;
    });
    return this.toPaidFeatureOverride(override);
  }

  async moderationQueue() {
    const [tutors, media, reviews] = await Promise.all([
      this.prisma.tutorProfile.findMany({
        where: { moderationStatus: "pending" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
      }),
      this.prisma.mediaAsset.findMany({
        where: { moderationStatus: "pending" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
      }),
      this.prisma.review.findMany({
        where: { status: { in: ["pending_moderation", "disputed"] } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
      }),
    ]);

    return {
      tutors: tutors.map((t) => this.toTutor(t)),
      media: media.map((m) => this.toMedia(m)),
      reviews: reviews.map((r) => this.toReview(r)),
    };
  }

  async listPayments(query: AdminPaymentsQueryDto) {
    const limit = clampLimit(query.limit);
    const where = this.paymentWhere(query);
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (p) =>
      encodeCursor(p.createdAt.toISOString(), p.id),
    );
    return {
      items: page.items.map((p) => this.toPayment(p)),
      next_cursor: page.next_cursor,
    };
  }

  async listAuditLogs(query: AdminAuditLogsQueryDto) {
    const limit = clampLimit(query.limit);
    const where = this.auditLogWhere(query);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (log) =>
      encodeCursor(log.createdAt.toISOString(), log.id),
    );
    return {
      items: page.items.map((log) => this.toAuditLog(log)),
      next_cursor: page.next_cursor,
    };
  }

  async setTutorStatus(actorUserId: string, id: string, dto: TutorStatusDto) {
    const before = await this.prisma.tutorProfile.findUnique({ where: { id } });
    if (!before) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy gia sư",
      );
    }
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tutorProfile.update({
        where: { id },
        data: {
          status: dto.status,
          moderationStatus:
            dto.status === "published" ? "approved" : before.moderationStatus,
          version: { increment: 1 },
          ...(dto.status === "published" && !before.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
      });
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: "admin.tutor_status",
        entityType: "tutor_profile",
        entityId: id,
        before,
        after: updated,
      });
      return updated;
    });
    return this.toTutor(after);
  }

  async moderateReview(
    actorUserId: string,
    id: string,
    dto: ModerateReviewDto,
  ) {
    const before = await this.prisma.review.findUnique({ where: { id } });
    if (!before) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy đánh giá",
      );
    }
    const status = dto.action === "publish" ? "published" : "hidden";
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: { status },
      });
      await this.recomputeTutorRating(tx, updated.tutorProfileId);
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: `admin.review_${dto.action}`,
        entityType: "review",
        entityId: id,
        before,
        after: updated,
      });
      return updated;
    });
    return this.toReview(after);
  }

  async moderateMedia(actorUserId: string, id: string, dto: ModerateMediaDto) {
    const before = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!before) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy media",
      );
    }
    const moderationStatus = dto.action === "approve" ? "approved" : "rejected";
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mediaAsset.update({
        where: { id },
        data: {
          moderationStatus,
          ...(dto.scan_status ? { scanStatus: dto.scan_status } : {}),
        },
      });
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: `admin.media_${dto.action}`,
        entityType: "media_asset",
        entityId: id,
        before,
        after: updated,
      });
      return updated;
    });
    return this.toMedia(after);
  }

  async refund(actorUserId: string, dto: RefundDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.payment_id },
      include: { profileUnlock: true, subscription: true },
    });
    if (!payment) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy thanh toán",
      );
    }
    if (payment.status !== "paid") {
      throw new AppException(
        ErrorCode.INVALID_STATE_TRANSITION,
        "Chỉ thanh toán paid mới được hoàn tiền",
      );
    }
    const amount =
      dto.amount !== undefined ? BigInt(dto.amount) : payment.amount;
    if (amount <= 0n || amount > payment.amount) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        "Số tiền hoàn không hợp lệ",
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          id: newId(),
          paymentId: payment.id,
          amount,
          reason: dto.reason,
          actorUserId,
          status: "done",
          processedAt: new Date(),
        },
      });
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "refunded", version: { increment: 1 } },
      });
      if (payment.profileUnlock) {
        await tx.profileUnlock.update({
          where: { id: payment.profileUnlock.id },
          data: { status: "revoked" },
        });
      }
      if (payment.subscription) {
        await tx.subscription.update({
          where: { id: payment.subscription.id },
          data: {
            status: "refunded",
            currentPeriodEnd: new Date(),
            version: { increment: 1 },
          },
        });
      }
      await this.audit.log(tx, {
        actorUserId,
        actorRole: "admin",
        action: "admin.refund",
        entityType: "payment",
        entityId: payment.id,
        before: payment,
        after: { payment: updatedPayment, refund },
      });
      return { refund, payment: updatedPayment };
    });

    return {
      refund: {
        id: result.refund.id,
        payment_id: result.refund.paymentId,
        amount: Number(result.refund.amount),
        reason: result.refund.reason,
        status: result.refund.status,
        processed_at: result.refund.processedAt?.toISOString() ?? null,
      },
      payment: this.toPayment(result.payment),
    };
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) return null;
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    return range;
  }

  private countRoles(users: Array<{ roles: string[] }>) {
    return users.reduce(
      (acc, user) => {
        if (user.roles.includes("parent")) acc.parent += 1;
        if (user.roles.includes("tutor")) acc.tutor += 1;
        if (user.roles.includes("admin")) acc.admin += 1;
        return acc;
      },
      { parent: 0, tutor: 0, admin: 0 },
    );
  }

  private registrationsByDay(users: Array<{ createdAt: Date }>) {
    const counts = new Map<string, number>();
    for (const user of users) {
      const day = user.createdAt.toISOString().slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }

  private userWhere(query: AdminUsersQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.roles = { has: query.role };
    if (query.status) where.status = query.status;
    const createdAt = this.dateRange(query.created_from, query.created_to);
    if (createdAt) where.createdAt = createdAt;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { id: q },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }
    const cursor = this.createdAtCursorWhere(query.cursor);
    if (cursor) {
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [...existingAnd, { OR: cursor }];
    }
    return where;
  }

  private async systemAuditLogs(query: AdminSystemLogsQueryDto) {
    const limit = clampLimit(query.limit);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.status) where.action = query.status;
    if (query.actor_user_id) where.actorUserId = query.actor_user_id;
    if (query.entity_type) where.entityType = query.entity_type;
    if (query.entity_id) where.entityId = query.entity_id;
    const cursor = this.createdAtCursorWhere(query.cursor);
    if (cursor) where.OR = cursor;
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (log) =>
      encodeCursor(log.createdAt.toISOString(), log.id),
    );
    return {
      items: page.items.map((log) => ({ type: "audit", ...this.toAuditLog(log) })),
      next_cursor: page.next_cursor,
    };
  }

  private async systemWebhookLogs(query: AdminSystemLogsQueryDto) {
    const limit = clampLimit(query.limit);
    const where: Prisma.WebhookEventWhereInput = {};
    if (query.status) where.processStatus = query.status;
    if (query.entity_id) where.providerReference = query.entity_id;
    const cursor = this.receivedAtCursorWhere(query.cursor);
    if (cursor) where.OR = cursor;
    const rows = await this.prisma.webhookEvent.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (event) =>
      encodeCursor(event.receivedAt.toISOString(), event.id),
    );
    return {
      items: page.items.map((event) => ({
        id: event.id,
        type: "webhook",
        provider: event.provider,
        provider_reference: event.providerReference,
        signature_verified: event.signatureVerified,
        process_status: event.processStatus,
        received_at: event.receivedAt.toISOString(),
        processed_at: event.processedAt?.toISOString() ?? null,
      })),
      next_cursor: page.next_cursor,
    };
  }

  private async systemOutboxLogs(query: AdminSystemLogsQueryDto) {
    const limit = clampLimit(query.limit);
    const where: Prisma.OutboxEventWhereInput = {};
    if (query.status) where.status = query.status as any;
    if (query.entity_type) where.aggregateType = query.entity_type;
    if (query.entity_id) where.aggregateId = query.entity_id;
    const cursor = this.createdAtCursorWhere(query.cursor);
    if (cursor) where.OR = cursor;
    const rows = await this.prisma.outboxEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = buildKeyset(rows, limit, (event) =>
      encodeCursor(event.createdAt.toISOString(), event.id),
    );
    return {
      items: page.items.map((event) => ({
        id: event.id,
        type: "outbox",
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        event_type: event.eventType,
        status: event.status,
        retry_count: event.retryCount,
        available_at: event.availableAt.toISOString(),
        created_at: event.createdAt.toISOString(),
        processed_at: event.processedAt?.toISOString() ?? null,
      })),
      next_cursor: page.next_cursor,
    };
  }

  private receivedAtCursorWhere(cursor?: string) {
    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    if (!decoded) return null;
    const [value, id] = decoded;
    const receivedAt = new Date(String(value));
    if (Number.isNaN(receivedAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    return [{ receivedAt: { lt: receivedAt } }, { receivedAt, id: { lt: id } }];
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy user");
    }
  }

  private parseProductType(raw: string): ProductType {
    if (!PRODUCT_TYPES.includes(raw as CheckoutProduct)) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "product_type không hợp lệ");
    }
    return raw as ProductType;
  }

  private parsePaidFeature(raw: string): PaidFeature {
    if (!PAID_FEATURES.includes(raw as PaidFeature)) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "feature không hợp lệ");
    }
    return raw as PaidFeature;
  }

  private entitlementState(
    feature: PaidFeature,
    subscriptions: Subscription[],
    activeUnlockCount: number,
  ): "active" | "inactive" {
    if (feature === "single_unlock") {
      return activeUnlockCount > 0 ? "active" : "inactive";
    }
    if (feature === "parent_vip") {
      return subscriptions.some((s) => s.type === "parent_vip_unlock")
        ? "active"
        : "inactive";
    }
    return subscriptions.some((s) => s.type === feature) ? "active" : "inactive";
  }

  private defaultPricingRow(productType: CheckoutProduct): ProductPricing {
    const fallback = DEFAULT_PRICING[productType];
    const now = new Date(0);
    return {
      id: `default-${productType}`,
      productType,
      amount: fallback.amount,
      currency: "VND",
      periodDays: fallback.periodDays,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  private safePlatformAccount(account: PlatformPaymentAccount) {
    return {
      id: account.id,
      bankCode: account.bankCode,
      accountNumberMasked: this.maskAccount(account.accountNumber),
      accountHolder: account.accountHolder,
      isActive: account.isActive,
    };
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

  private toUserCard(
    u: User & {
      parentProfile?: { id: string; status: string; displayName: string } | null;
      tutorProfile?: {
        id: string;
        status: string;
        moderationStatus: string;
        displayName: string;
      } | null;
      subscriptions?: Array<{
        type: string;
        scopeRefId: string | null;
        currentPeriodEnd: Date | null;
      }>;
      paidFeatureOverrides?: Array<{
        feature: PaidFeature;
        enabled: boolean;
        expiresAt: Date | null;
      }>;
    },
  ) {
    return {
      ...this.toUserBase(u),
      profiles: {
        parent_profile_id: u.parentProfile?.id ?? null,
        parent_status: u.parentProfile?.status ?? null,
        tutor_profile_id: u.tutorProfile?.id ?? null,
        tutor_status: u.tutorProfile?.status ?? null,
        tutor_moderation_status: u.tutorProfile?.moderationStatus ?? null,
      },
      paid_features: this.paidFeatureSummary(
        u.subscriptions ?? [],
        u.paidFeatureOverrides ?? [],
      ),
    };
  }

  private toUserBase(u: User) {
    return {
      id: u.id,
      email_masked: this.maskEmail(u.email),
      phone_masked: this.maskPhone(u.phone),
      roles: u.roles,
      status: u.status,
      created_at: u.createdAt.toISOString(),
      updated_at: u.updatedAt.toISOString(),
    };
  }

  private paidFeatureSummary(
    subscriptions: Array<{ type: string; currentPeriodEnd: Date | null }>,
    overrides: Array<{ feature: PaidFeature; enabled: boolean; expiresAt: Date | null }>,
  ) {
    const now = new Date();
    const activeSubs = new Set(
      subscriptions
        .filter((s) => !s.currentPeriodEnd || s.currentPeriodEnd > now)
        .map((s) => s.type),
    );
    const activeOverrides = new Map(
      overrides
        .filter((o) => !o.expiresAt || o.expiresAt > now)
        .map((o) => [o.feature, o.enabled]),
    );
    return {
      single_unlock: activeOverrides.has("single_unlock")
        ? this.overrideLabel(activeOverrides.get("single_unlock")!)
        : "inactive",
      parent_vip: activeOverrides.has("parent_vip")
        ? this.overrideLabel(activeOverrides.get("parent_vip")!)
        : activeSubs.has("parent_vip_unlock")
          ? "active"
          : "inactive",
      parent_tracking: activeOverrides.has("parent_tracking")
        ? this.overrideLabel(activeOverrides.get("parent_tracking")!)
        : activeSubs.has("parent_tracking")
          ? "active"
          : "inactive",
      tutor_qr: activeOverrides.has("tutor_qr")
        ? this.overrideLabel(activeOverrides.get("tutor_qr")!)
        : activeSubs.has("tutor_qr")
          ? "active"
          : "inactive",
    };
  }

  private overrideLabel(enabled: boolean): "override_enabled" | "override_disabled" {
    return enabled ? "override_enabled" : "override_disabled";
  }

  private toSubscription(s: Subscription) {
    return {
      id: s.id,
      type: s.type,
      scope_ref_id: s.scopeRefId,
      payment_id: s.paymentId,
      status: s.status,
      auto_renew: s.autoRenew,
      starts_at: s.startsAt?.toISOString() ?? null,
      current_period_end: s.currentPeriodEnd?.toISOString() ?? null,
      cancelled_at: s.cancelledAt?.toISOString() ?? null,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    };
  }

  private toPlatformPaymentAccount(account: PlatformPaymentAccount) {
    return {
      bank_code: account.bankCode,
      account_number_masked: this.maskAccount(account.accountNumber),
      account_holder: account.accountHolder,
      is_active: account.isActive,
      updated_at: account.updatedAt.toISOString(),
    };
  }

  private toPricing(p: ProductPricing) {
    return {
      product_type: p.productType,
      amount: Number(p.amount),
      currency: p.currency,
      period_days: p.periodDays,
      is_enabled: p.isEnabled,
      updated_at: p.updatedAt.toISOString(),
    };
  }

  private toPaidFeatureOverride(o: PaidFeatureOverride) {
    return {
      id: o.id,
      user_id: o.userId,
      feature: o.feature,
      enabled: o.enabled,
      reason: o.reason,
      expires_at: o.expiresAt?.toISOString() ?? null,
      created_at: o.createdAt.toISOString(),
      updated_at: o.updatedAt.toISOString(),
    };
  }

  private maskEmail(email?: string | null) {
    if (!email) return null;
    const [name, domain] = email.split("@");
    if (!domain) return "***";
    const visible = name.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
  }

  private maskPhone(phone?: string | null) {
    if (!phone) return null;
    const tail = phone.slice(-4);
    return `${"*".repeat(Math.max(0, phone.length - 4))}${tail}`;
  }

  private maskAccount(account: string) {
    const tail = account.slice(-4);
    return `${"*".repeat(Math.max(0, account.length - 4))}${tail}`;
  }

  private toTutor(t: TutorProfile) {
    return {
      id: t.id,
      user_id: t.userId,
      display_name: t.displayName,
      status: t.status,
      moderation_status: t.moderationStatus,
      published_at: t.publishedAt?.toISOString() ?? null,
      rating_avg: t.ratingAvg,
      rating_count: t.ratingCount,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    };
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

  private toMedia(m: MediaAsset) {
    return {
      id: m.id,
      owner_user_id: m.ownerUserId,
      kind: m.kind,
      content_type: m.contentType,
      size_bytes: Number(m.sizeBytes),
      moderation_status: m.moderationStatus,
      scan_status: m.scanStatus,
      created_at: m.createdAt.toISOString(),
    };
  }

  private paymentWhere(query: AdminPaymentsQueryDto): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.product_type) where.productType = query.product_type;
    if (query.payer_user_id) where.payerUserId = query.payer_user_id;

    const cursor = this.createdAtCursorWhere(query.cursor);
    if (cursor) where.OR = cursor;
    return where;
  }

  private auditLogWhere(
    query: AdminAuditLogsQueryDto,
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actor_user_id) where.actorUserId = query.actor_user_id;
    if (query.action) where.action = query.action;
    if (query.entity_type) where.entityType = query.entity_type;
    if (query.entity_id) where.entityId = query.entity_id;

    const cursor = this.createdAtCursorWhere(query.cursor);
    if (cursor) where.OR = cursor;
    return where;
  }

  private createdAtCursorWhere(cursor?: string) {
    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    if (!decoded) return null;

    const [value, id] = decoded;
    const createdAt = new Date(String(value));
    if (Number.isNaN(createdAt.getTime())) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, "Cursor không hợp lệ");
    }
    return [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }];
  }

  private toPayment(p: Payment) {
    return {
      id: p.id,
      payer_user_id: p.payerUserId,
      product_type: p.productType,
      target_ref_id: p.targetRefId,
      amount: Number(p.amount),
      currency: p.currency,
      provider: p.provider,
      provider_reference: p.providerReference,
      status: p.status,
      created_at: p.createdAt.toISOString(),
      paid_at: p.paidAt?.toISOString() ?? null,
    };
  }

  private toAuditLog(log: AuditLog) {
    return {
      id: log.id,
      actor_user_id: log.actorUserId,
      actor_role: log.actorRole,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      before_hash: log.beforeHash,
      after_hash: log.afterHash,
      created_at: log.createdAt.toISOString(),
    };
  }
}
