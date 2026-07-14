import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Payment,
  ProductType,
  Subscription,
  SubscriptionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthUser } from '../../common/auth/auth-user';
import { newId } from '../../common/utils/id.util';
import { sha256 } from '../../common/utils/hash.util';
import {
  extractProviderReference,
  providerReference,
  vietQrImageUrl,
} from '../../common/payments/vietqr.util';
import { OutboxService } from '../../common/shared/outbox.service';
import { Db } from '../../common/shared/db.type';
import { PaidFeatureService } from '../../common/shared/paid-feature.service';
import { CheckoutDto, SepayWebhookDto } from './dto/billing.dto';

type CheckoutProduct = CheckoutDto['product_type'];

interface ProductSpec {
  productType: ProductType;
  subscriptionType?: SubscriptionType;
  amount: bigint;
  targetRequired: boolean;
  periodDays?: number;
  isEnabled: boolean;
}

interface SepayEvent {
  providerReference: string;
  amount: bigint;
  externalId: string;
}

const PRODUCT_SPECS: Record<CheckoutProduct, ProductSpec> = {
  single_unlock: {
    productType: 'single_unlock',
    amount: 49_000n,
    targetRequired: true,
    isEnabled: true,
  },
  parent_vip: {
    productType: 'parent_vip',
    subscriptionType: 'parent_vip_unlock',
    amount: 150_000n,
    targetRequired: false,
    periodDays: 30,
    isEnabled: true,
  },
  parent_tracking: {
    productType: 'parent_tracking',
    subscriptionType: 'parent_tracking',
    amount: 69_000n,
    targetRequired: true,
    periodDays: 30,
    isEnabled: true,
  },
  tutor_qr: {
    productType: 'tutor_qr',
    subscriptionType: 'tutor_qr',
    amount: 30_000n,
    targetRequired: false,
    periodDays: 30,
    isEnabled: true,
  },
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly paidFeatures?: PaidFeatureService,
  ) {}

  // POST /billing/checkout — tạo payment pending + VietQR vào tài khoản nền tảng.
  async checkout(
    user: AuthUser,
    dto: CheckoutDto,
    headerIdempotencyKey?: string,
  ) {
    const spec = await this.resolveProductSpec(dto.product_type);
    const idempotencyKey = (headerIdempotencyKey ?? dto.idempotency_key)?.trim();
    const targetRefId = dto.target_ref_id?.trim() || null;

    if (!spec.isEnabled) {
      throw new AppException(
        ErrorCode.PAYMENT_REQUIRED,
        'Sản phẩm thanh toán đang tạm tắt',
      );
    }
    this.validateTargetPresence(spec, dto.product_type, targetRefId);
    await this.assertPurchasable(user, dto.product_type, targetRefId);

    if (idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { payerUserId: user.userId, idempotencyKey },
      });
      if (existing) {
        const expectedHash = this.checkoutHash(dto.product_type, targetRefId);
        const idem = await this.prisma.idempotencyKey.findUnique({
          where: {
            scope_key: {
              scope: this.idempotencyScope(user.userId),
              key: idempotencyKey,
            },
          },
        });
        if (idem?.responseHash && idem.responseHash !== expectedHash) {
          throw new AppException(
            ErrorCode.IDEMPOTENCY_CONFLICT,
            'Idempotency-Key đã được dùng cho payload khác',
          );
        }
        return this.toPaymentResponse(existing);
      }
    }

    const paymentId = newId();
    const ref = providerReference(paymentId);
    const payment = await this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            id: newId(),
            scope: this.idempotencyScope(user.userId),
            key: idempotencyKey,
            userId: user.userId,
            responseHash: this.checkoutHash(dto.product_type, targetRefId),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      const created = await tx.payment.create({
        data: {
          id: paymentId,
          payerUserId: user.userId,
          productType: spec.productType,
          targetRefId,
          amount: spec.amount,
          providerReference: ref,
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      if (spec.subscriptionType) {
        await tx.subscription.create({
          data: {
            id: newId(),
            userId: user.userId,
            type: spec.subscriptionType,
            scopeRefId: dto.product_type === 'parent_tracking' ? targetRefId : null,
            paymentId: created.id,
            status: 'pending_payment',
          },
        });
      }

      return created;
    });

    return this.toPaymentResponse(payment);
  }

  async getPayment(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, payerUserId: userId },
      include: {
        profileUnlock: true,
        subscription: true,
      },
    });
    if (!payment) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy thanh toán',
      );
    }
    return this.toPaymentResponse(payment);
  }

  // POST /billing/webhook/sepay — verify nguồn, chống trùng, đối chiếu mã+số tiền.
  async handleSepayWebhook(
    payload: SepayWebhookDto,
    headers: Record<string, string>,
    ip: string,
  ) {
    this.assertWebhookTrusted(headers, ip);
    const event = this.parseSepayPayload(payload);
    const rawPayloadHash = sha256(JSON.stringify(payload));

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.webhookEvent.findUnique({
        where: {
          provider_providerReference: {
            provider: 'sepay',
            providerReference: event.providerReference,
          },
        },
      });
      if (duplicate) {
        return { received: true, duplicate: true, status: duplicate.processStatus };
      }

      const webhook = await tx.webhookEvent.create({
        data: {
          id: newId(),
          provider: 'sepay',
          providerReference: event.providerReference,
          signatureVerified: true,
          rawPayloadHash,
        },
      });

      const payment = await tx.payment.findUnique({
        where: { providerReference: event.providerReference },
        include: { subscription: true },
      });
      if (!payment) {
        await tx.webhookEvent.update({
          where: { id: webhook.id },
          data: { processStatus: 'ignored_no_payment', processedAt: new Date() },
        });
        return { received: true, matched: false };
      }

      if (payment.amount !== event.amount) {
        await tx.webhookEvent.update({
          where: { id: webhook.id },
          data: { processStatus: 'amount_mismatch', processedAt: new Date() },
        });
        throw new AppException(
          ErrorCode.WEBHOOK_INVALID,
          'Số tiền webhook không khớp payment',
        );
      }

      if (payment.status === 'paid') {
        await tx.webhookEvent.update({
          where: { id: webhook.id },
          data: { processStatus: 'already_paid', processedAt: new Date() },
        });
        return { received: true, payment_id: payment.id, status: 'paid' };
      }
      if (payment.status !== 'pending') {
        await tx.webhookEvent.update({
          where: { id: webhook.id },
          data: { processStatus: `ignored_${payment.status}`, processedAt: new Date() },
        });
        return { received: true, payment_id: payment.id, status: payment.status };
      }

      const paidAt = new Date();
      const paid = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          paidAt,
          version: { increment: 1 },
        },
      });
      await this.applyPaidEntitlement(tx, paid, paidAt);
      await tx.webhookEvent.update({
        where: { id: webhook.id },
        data: { processStatus: 'processed', processedAt: paidAt },
      });
      await this.outbox.emit(tx, {
        aggregateType: 'payment',
        aggregateId: paid.id,
        eventType: 'payment.paid',
        payload: {
          payment_id: paid.id,
          product_type: paid.productType,
          target_ref_id: paid.targetRefId,
        },
      });

      return { received: true, payment_id: paid.id, status: 'paid' };
    });
  }

  async listSubscriptions(userId: string) {
    const items = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { items: items.map((s) => this.toSubscription(s)) };
  }

  async cancelSubscription(userId: string, id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
    });
    if (!sub) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy gói đăng ký',
      );
    }
    if (sub.status === 'cancelled') return this.toSubscription(sub);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        autoRenew: false,
        version: { increment: 1 },
      },
    });
    return this.toSubscription(updated);
  }

  private validateTargetPresence(
    spec: ProductSpec,
    productType: CheckoutProduct,
    targetRefId: string | null,
  ): void {
    if (spec.targetRequired && !targetRefId) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `${productType} cần target_ref_id`,
      );
    }
    if (!spec.targetRequired && targetRefId) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `${productType} không dùng target_ref_id`,
      );
    }
  }

  private async assertPurchasable(
    user: AuthUser,
    productType: CheckoutProduct,
    targetRefId: string | null,
  ): Promise<void> {
    await this.assertFeatureNotDisabled(user.userId, productType);

    if (productType === 'single_unlock') {
      if (!user.roles.includes('parent') || !user.parentProfileId) {
        throw new AppException(
          ErrorCode.FORBIDDEN_ROLE,
          'Chỉ phụ huynh được mở khóa hồ sơ',
        );
      }
      const tutor = await this.prisma.tutorProfile.findFirst({
        where: { id: targetRefId!, status: 'published' },
        select: { id: true },
      });
      if (!tutor) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy hồ sơ gia sư đang xuất bản',
        );
      }
      const existing = await this.prisma.profileUnlock.findFirst({
        where: {
          parentProfileId: user.parentProfileId,
          tutorProfileId: targetRefId!,
          status: 'active',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (existing) {
        throw new AppException(ErrorCode.CONFLICT, 'Hồ sơ đã được mở khóa');
      }
      return;
    }

    if (productType === 'parent_vip') {
      this.assertRole(user, 'parent', 'Chỉ phụ huynh được mua VIP');
      await this.assertNoActiveSubscription(user.userId, 'parent_vip_unlock');
      return;
    }

    if (productType === 'parent_tracking') {
      if (!user.roles.includes('parent') || !user.parentProfileId) {
        throw new AppException(
          ErrorCode.FORBIDDEN_ROLE,
          'Chỉ phụ huynh được mua gói theo dõi',
        );
      }
      const student = await this.prisma.student.findFirst({
        where: { id: targetRefId!, parentProfileId: user.parentProfileId },
        select: { id: true },
      });
      if (!student) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy học sinh của bạn',
        );
      }
      await this.assertNoActiveSubscription(
        user.userId,
        'parent_tracking',
        targetRefId!,
      );
      return;
    }

    this.assertRole(user, 'tutor', 'Chỉ gia sư được mua gói QR');
    await this.assertNoActiveSubscription(user.userId, 'tutor_qr');
  }

  private async assertFeatureNotDisabled(
    userId: string,
    productType: CheckoutProduct,
  ): Promise<void> {
    if (!this.paidFeatures) return;
    const disabled = await this.paidFeatures.isDisabled(
      userId,
      this.productFeature(productType),
    );
    if (disabled) {
      throw new AppException(
        ErrorCode.FORBIDDEN_ROLE,
        'Tính năng trả phí đang bị tắt cho user này',
      );
    }
  }

  private productFeature(productType: CheckoutProduct) {
    if (productType === 'parent_vip') return 'parent_vip' as const;
    return productType;
  }

  private assertRole(user: AuthUser, role: 'parent' | 'tutor', message: string) {
    if (!user.roles.includes(role)) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, message);
    }
  }

  private async assertNoActiveSubscription(
    userId: string,
    type: SubscriptionType,
    scopeRefId?: string,
  ) {
    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId,
        type,
        status: { in: ['pending_payment', 'active', 'past_due'] },
        ...(scopeRefId !== undefined ? { scopeRefId } : {}),
        OR: [
          { status: 'pending_payment' },
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppException(ErrorCode.CONFLICT, 'Gói hiện tại vẫn còn hiệu lực');
    }
  }

  private async applyPaidEntitlement(
    tx: Db,
    payment: Payment,
    paidAt: Date,
  ): Promise<void> {
    if (payment.productType === 'single_unlock') {
      const parent = await tx.parentProfile.findUnique({
        where: { userId: payment.payerUserId },
        select: { id: true },
      });
      if (!parent || !payment.targetRefId) {
        throw new AppException(
          ErrorCode.WEBHOOK_INVALID,
          'Payment mở khóa thiếu parent/target',
        );
      }
      const existing = await tx.profileUnlock.findUnique({
        where: {
          parentProfileId_tutorProfileId: {
            parentProfileId: parent.id,
            tutorProfileId: payment.targetRefId,
          },
        },
      });
      if (existing) {
        await tx.profileUnlock.update({
          where: { id: existing.id },
          data: { status: 'active', expiresAt: null },
        });
      } else {
        await tx.profileUnlock.create({
          data: {
            id: newId(),
            parentProfileId: parent.id,
            tutorProfileId: payment.targetRefId,
            paymentId: payment.id,
            source: 'single_unlock',
            startsAt: paidAt,
            expiresAt: null,
            status: 'active',
          },
        });
      }
      return;
    }

    const spec = await this.resolveProductSpec(payment.productType);
    if (!spec.subscriptionType || !spec.periodDays) {
      throw new AppException(
        ErrorCode.WEBHOOK_INVALID,
        'Payment không có cấu hình gói',
      );
    }
    const currentPeriodEnd = new Date(
      paidAt.getTime() + spec.periodDays * 24 * 60 * 60 * 1000,
    );
    const sub = await tx.subscription.findUnique({
      where: { paymentId: payment.id },
    });
    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'active',
          startsAt: paidAt,
          currentPeriodEnd,
          version: { increment: 1 },
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          id: newId(),
          userId: payment.payerUserId,
          type: spec.subscriptionType,
          scopeRefId:
            payment.productType === 'parent_tracking' ? payment.targetRefId : null,
          paymentId: payment.id,
          status: 'active',
          startsAt: paidAt,
          currentPeriodEnd,
        },
      });
    }
  }

  private assertWebhookTrusted(
    headers: Record<string, string>,
    ip: string,
  ): void {
    const configuredKey = this.config.get<string>('payment.sepayWebhookApiKey');
    const presented =
      headers['x-sepay-api-key'] ??
      headers['x-webhook-api-key'] ??
      headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (configuredKey && presented !== configuredKey) {
      throw new AppException(ErrorCode.WEBHOOK_INVALID, 'Webhook API key sai');
    }

    const allowlist =
      this.config.get<string[]>('payment.sepayIpAllowlist') ?? [];
    if (allowlist.length === 0) return;
    const normalized = ip.replace(/^::ffff:/, '');
    if (!allowlist.includes(normalized)) {
      throw new AppException(
        ErrorCode.WEBHOOK_INVALID,
        'IP webhook không nằm trong allowlist',
      );
    }
  }

  private parseSepayPayload(payload: SepayWebhookDto): SepayEvent {
    const content =
      payload.content ?? payload.description ?? payload.transfer_content ?? '';
    const fromPayload = payload.reference ?? payload.code;
    const ref =
      (fromPayload?.startsWith('KTT') ? fromPayload.toUpperCase() : null) ??
      extractProviderReference(content);
    if (!ref) {
      throw new AppException(
        ErrorCode.WEBHOOK_INVALID,
        'Webhook thiếu provider_reference',
      );
    }

    const rawAmount =
      payload.amount ?? payload.transferAmount ?? payload.transfer_amount;
    const amount = this.parseAmount(rawAmount);
    if (amount <= 0n) {
      throw new AppException(ErrorCode.WEBHOOK_INVALID, 'Số tiền webhook sai');
    }

    return {
      providerReference: ref,
      amount,
      externalId: payload.id ?? payload.transaction_id ?? sha256(JSON.stringify(payload)),
    };
  }

  private parseAmount(raw: unknown): bigint {
    if (typeof raw === 'number' && Number.isSafeInteger(raw)) return BigInt(raw);
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
      return BigInt(raw.trim());
    }
    throw new AppException(ErrorCode.WEBHOOK_INVALID, 'Số tiền webhook sai');
  }

  private async toPaymentResponse(
    payment: Payment & {
      profileUnlock?: unknown | null;
      subscription?: Subscription | null;
    },
  ) {
    const addInfo = payment.providerReference ?? providerReference(payment.id);
    const amount = Number(payment.amount);
    const account = await this.activePlatformPaymentAccount();
    return {
      payment_id: payment.id,
      product_type: payment.productType,
      target_ref_id: payment.targetRefId,
      amount,
      currency: payment.currency,
      provider: payment.provider,
      provider_reference: addInfo,
      status: payment.status,
      paid_at: payment.paidAt?.toISOString() ?? null,
      vietqr: {
        qr_url: vietQrImageUrl({
          bankCode: account.bankCode,
          accountNumber: account.accountNumber,
          accountName: account.accountHolder,
          amount,
          addInfo,
        }),
        transfer_content: addInfo,
      },
      entitlement: this.paymentEntitlement(payment),
    };
  }

  private paymentEntitlement(
    payment: Payment & { subscription?: Subscription | null },
  ) {
    if (payment.productType === 'single_unlock') {
      return {
        kind: 'profile_unlock',
        tutor_profile_id: payment.targetRefId,
        active: payment.status === 'paid',
      };
    }
    const spec = PRODUCT_SPECS[payment.productType];
    const status = payment.subscription
      ? payment.subscription.status
      : payment.status === 'paid'
        ? 'active'
        : 'pending_payment';
    return {
      kind: 'subscription',
      type: spec.subscriptionType,
      scope_ref_id: payment.targetRefId,
      status,
      active: payment.status === 'paid',
    };
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

  private idempotencyScope(userId: string): string {
    return `billing.checkout:${userId}`;
  }

  private checkoutHash(
    productType: CheckoutProduct,
    targetRefId: string | null,
  ): string {
    return sha256(JSON.stringify({ product_type: productType, target_ref_id: targetRefId }));
  }

  private async resolveProductSpec(
    productType: CheckoutProduct,
    db: Partial<Db> | PrismaService = this.prisma,
  ): Promise<ProductSpec> {
    const fallback = PRODUCT_SPECS[productType];
    const pricingModel = (db as any).productPricing;
    if (!pricingModel?.findUnique) return fallback;

    const pricing = await pricingModel.findUnique({
      where: { productType: fallback.productType },
    });
    if (!pricing) return fallback;

    return {
      ...fallback,
      amount: pricing.amount,
      periodDays: pricing.periodDays ?? fallback.periodDays,
      isEnabled: pricing.isEnabled,
    };
  }

  private async activePlatformPaymentAccount(): Promise<{
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
  }> {
    const accountModel = (this.prisma as any).platformPaymentAccount;
    const account = accountModel?.findFirst
      ? await accountModel.findFirst({
          where: { isActive: true },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        })
      : null;
    if (account) {
      return {
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder,
      };
    }
    return {
      bankCode: this.config.get<string>('payment.platformBankCode') ?? '',
      accountNumber: this.config.get<string>('payment.platformBankAccount') ?? '',
      accountHolder:
        this.config.get<string>('payment.platformBankAccountName') ?? '',
    };
  }
}
