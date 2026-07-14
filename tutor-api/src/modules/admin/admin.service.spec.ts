import { AdminService } from "./admin.service";
import { encodeCursor } from "../../common/pagination/keyset";

const now = new Date("2026-01-01T00:00:00Z");
const tutor = {
  id: "tutor-1",
  userId: "tutor-user",
  displayName: "Co Linh",
  avatarMediaId: null,
  introVideoMediaId: null,
  bio: null,
  region: null,
  voiceAccent: null,
  gender: null,
  educationLevel: null,
  schoolName: null,
  studentYear: null,
  examScore: null,
  gpa: null,
  expectedFeeMin: null,
  expectedFeeMax: null,
  status: "hidden",
  moderationStatus: "pending",
  ratingAvg: 0,
  ratingCount: 0,
  version: 0,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};
const payment = {
  id: "payment-1",
  payerUserId: "user-1",
  productType: "single_unlock",
  targetRefId: tutor.id,
  amount: 49_000n,
  currency: "VND",
  provider: "sepay",
  providerReference: "KTT000000000001",
  status: "paid",
  idempotencyKey: null,
  version: 0,
  createdAt: now,
  paidAt: now,
  profileUnlock: { id: "unlock-1" },
  subscription: null,
};
const media = {
  id: "media-1",
  ownerUserId: "user-1",
  kind: "intro_video",
  storageKey: "intro_video/user-1/media-1",
  contentType: "video/mp4",
  sizeBytes: 1024n,
  moderationStatus: "pending",
  scanStatus: "pending",
  createdAt: now,
};

describe("AdminService", () => {
  it("lists payments for admin with filters and keyset cursor output", async () => {
    const second = {
      ...payment,
      id: "payment-2",
      payerUserId: "user-2",
      providerReference: "KTT000000000002",
      createdAt: new Date("2026-01-01T00:01:00Z"),
    };
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([second, payment]),
      },
    };
    const service = new AdminService(prisma as any, {} as any);

    const result = await service.listPayments({
      status: "paid",
      product_type: "single_unlock",
      payer_user_id: "user-1",
      limit: "1",
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        status: "paid",
        productType: "single_unlock",
        payerUserId: "user-1",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "payment-2",
          payer_user_id: "user-2",
          amount: 49000,
          status: "paid",
          created_at: second.createdAt.toISOString(),
        }),
      ],
      next_cursor: encodeCursor(second.createdAt.toISOString(), second.id),
    });
  });

  it("rejects invalid admin payment cursors", async () => {
    const service = new AdminService(
      { payment: { findMany: jest.fn() } } as any,
      {} as any,
    );

    await expect(
      service.listPayments({ cursor: "not-base64-json" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("lists audit logs for admin without exposing IP addresses", async () => {
    const auditLog = {
      id: "audit-1",
      actorUserId: "admin-1",
      actorRole: "admin",
      action: "admin.refund",
      entityType: "payment",
      entityId: payment.id,
      beforeHash: "before-hash",
      afterHash: "after-hash",
      ipAddress: "127.0.0.1",
      createdAt: now,
    };
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([auditLog]),
      },
    };
    const service = new AdminService(prisma as any, {} as any);

    const result = await service.listAuditLogs({
      actor_user_id: "admin-1",
      action: "admin.refund",
      entity_type: "payment",
      entity_id: payment.id,
      limit: "20",
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        actorUserId: "admin-1",
        action: "admin.refund",
        entityType: "payment",
        entityId: payment.id,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    });
    expect(result).toEqual({
      items: [
        {
          id: "audit-1",
          actor_user_id: "admin-1",
          actor_role: "admin",
          action: "admin.refund",
          entity_type: "payment",
          entity_id: payment.id,
          before_hash: "before-hash",
          after_hash: "after-hash",
          created_at: now.toISOString(),
        },
      ],
      next_cursor: null,
    });
    expect(JSON.stringify(result)).not.toContain("127.0.0.1");
  });

  it("sets tutor status and writes audit log", async () => {
    const updated = {
      ...tutor,
      status: "published",
      moderationStatus: "approved",
      publishedAt: now,
    };
    const tx = {
      tutorProfile: { update: jest.fn().mockResolvedValue(updated) },
    };
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(tutor) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    const result = await service.setTutorStatus("admin-1", tutor.id, {
      status: "published",
    });

    expect(tx.tutorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: tutor.id },
        data: expect.objectContaining({
          status: "published",
          moderationStatus: "approved",
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorUserId: "admin-1",
        action: "admin.tutor_status",
      }),
    );
    expect(result).toMatchObject({ id: tutor.id, status: "published" });
  });

  it("moderates media assets and writes audit log", async () => {
    const updated = {
      ...media,
      moderationStatus: "approved",
      scanStatus: "clean",
    };
    const tx = {
      mediaAsset: { update: jest.fn().mockResolvedValue(updated) },
    };
    const prisma = {
      mediaAsset: { findUnique: jest.fn().mockResolvedValue(media) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    const result = await service.moderateMedia("admin-1", media.id, {
      action: "approve",
      scan_status: "clean",
    });

    expect(tx.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: media.id },
      data: { moderationStatus: "approved", scanStatus: "clean" },
    });
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorUserId: "admin-1",
        action: "admin.media_approve",
        entityType: "media_asset",
        entityId: media.id,
      }),
    );
    expect(result).toMatchObject({
      id: media.id,
      owner_user_id: "user-1",
      moderation_status: "approved",
      scan_status: "clean",
    });
  });

  it("refunds a paid payment and revokes profile unlock", async () => {
    const refund = {
      id: "refund-1",
      paymentId: payment.id,
      amount: 49_000n,
      reason: "duplicate transfer",
      status: "done",
      actorUserId: "admin-1",
      createdAt: now,
      processedAt: now,
    };
    const tx = {
      refund: { create: jest.fn().mockResolvedValue(refund) },
      payment: {
        update: jest.fn().mockResolvedValue({ ...payment, status: "refunded" }),
      },
      profileUnlock: { update: jest.fn() },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    const result = await service.refund("admin-1", {
      payment_id: payment.id,
      reason: "duplicate transfer",
    });

    expect(tx.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: payment.id,
          amount: payment.amount,
          status: "done",
        }),
      }),
    );
    expect(tx.profileUnlock.update).toHaveBeenCalledWith({
      where: { id: payment.profileUnlock.id },
      data: { status: "revoked" },
    });
    expect(result).toMatchObject({
      refund: { id: refund.id, status: "done", amount: 49000 },
      payment: { id: payment.id, status: "refunded" },
    });
  });

  it("sets platform payment account with masked output and audit log", async () => {
    const saved = {
      id: "platform-account-1",
      bankCode: "VCB",
      accountNumber: "123456789",
      accountHolder: "KIM THANH TUTOR",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const tx = {
      platformPaymentAccount: {
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue(saved),
      },
    };
    const prisma = {
      platformPaymentAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    const result = await service.setPlatformPaymentAccount("admin-1", {
      bank_code: "vcb",
      account_number: "123456789",
      account_holder: "KIM THANH TUTOR",
      is_active: true,
    });

    expect(tx.platformPaymentAccount.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(result).toEqual({
      bank_code: "VCB",
      account_number_masked: "*****6789",
      account_holder: "KIM THANH TUTOR",
      is_active: true,
      updated_at: now.toISOString(),
    });
    expect(JSON.stringify(result)).not.toContain("123456789");
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "admin.platform_payment_account",
        entityType: "platform_payment_account",
      }),
    );
  });

  it("upserts product pricing and writes audit log", async () => {
    const pricing = {
      id: "pricing-1",
      productType: "parent_tracking",
      amount: 79_000n,
      currency: "VND",
      periodDays: 30,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const tx = {
      productPricing: { upsert: jest.fn().mockResolvedValue(pricing) },
    };
    const prisma = {
      productPricing: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    const result = await service.setPricing("admin-1", "parent_tracking", {
      amount: 79000,
      period_days: 30,
      is_enabled: true,
      reason: "launch price",
    });

    expect(tx.productPricing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "parent_tracking" },
        create: expect.objectContaining({ amount: 79_000n }),
        update: expect.objectContaining({ amount: 79_000n }),
      }),
    );
    expect(result).toMatchObject({
      product_type: "parent_tracking",
      amount: 79000,
      period_days: 30,
      is_enabled: true,
    });
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "admin.pricing" }),
    );
  });

  it("suspends a user, revokes refresh tokens, and prevents self-suspension", async () => {
    const target = {
      id: "user-2",
      phone: "0900000002",
      email: "target@example.com",
      roles: ["tutor"],
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const updated = { ...target, status: "suspended" };
    const tx = {
      user: { update: jest.fn().mockResolvedValue(updated) },
      refreshToken: { updateMany: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(target) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    await expect(
      service.setUserStatus("user-2", "user-2", {
        status: "suspended",
        reason: "self",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const result = await service.setUserStatus("admin-1", "user-2", {
      status: "suspended",
      reason: "abuse",
    });

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-2", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result).toMatchObject({
      id: "user-2",
      status: "suspended",
      email_masked: "ta****@example.com",
      phone_masked: "******0002",
    });
  });

  it("upserts paid feature override", async () => {
    const override = {
      id: "override-1",
      userId: "user-1",
      feature: "tutor_qr",
      enabled: false,
      reason: "hold",
      expiresAt: new Date("2030-02-01T00:00:00Z"),
      createdAt: now,
      updatedAt: now,
    };
    const tx = {
      paidFeatureOverride: { upsert: jest.fn().mockResolvedValue(override) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "user-1" }) },
      paidFeatureOverride: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const audit = { log: jest.fn() };
    const service = new AdminService(prisma as any, audit as any);

    const result = await service.setPaidFeature("admin-1", "user-1", "tutor_qr", {
      enabled: false,
      reason: "hold",
      expires_at: "2030-02-01T00:00:00.000Z",
    });

    expect(tx.paidFeatureOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_feature: { userId: "user-1", feature: "tutor_qr" } },
      }),
    );
    expect(result).toMatchObject({
      user_id: "user-1",
      feature: "tutor_qr",
      enabled: false,
      reason: "hold",
    });
  });
});
