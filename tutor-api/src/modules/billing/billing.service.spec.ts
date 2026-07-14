import { BillingService } from './billing.service';
import { ErrorCode } from '../../common/errors/error-codes';

const payment = {
  id: '01HYPAYMENT000000000000',
  payerUserId: '01HYUSER0000000000000000',
  productType: 'single_unlock',
  targetRefId: '01HYTUTOR00000000000000',
  amount: 49_000n,
  currency: 'VND',
  provider: 'sepay',
  providerReference: 'KTT000000000000',
  status: 'pending',
  idempotencyKey: 'idem-1',
  version: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  paidAt: null,
};

const user = {
  userId: payment.payerUserId,
  roles: ['parent' as const],
  status: 'active',
  parentProfileId: '01HYPARENT000000000000',
};

function config() {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        'payment.platformBankCode': 'VCB',
        'payment.platformBankAccount': '123456789',
        'payment.platformBankAccountName': 'KIM THANH TUTOR',
        'payment.sepayWebhookApiKey': '',
        'payment.sepayIpAllowlist': [],
      };
      return values[key];
    }),
  };
}

describe('BillingService', () => {
  it('creates a pending payment with stable VietQR output', async () => {
    const tx = {
      idempotencyKey: { create: jest.fn() },
      payment: { create: jest.fn().mockResolvedValue(payment) },
      subscription: { create: jest.fn() },
    };
    const prisma = {
      tutorProfile: { findFirst: jest.fn().mockResolvedValue({ id: payment.targetRefId }) },
      profileUnlock: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new BillingService(prisma as any, config() as any, {} as any);

    const result = await service.checkout(
      user as any,
      { product_type: 'single_unlock', target_ref_id: payment.targetRefId },
      'idem-1',
    );

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payerUserId: user.userId,
          productType: 'single_unlock',
          targetRefId: payment.targetRefId,
          amount: 49_000n,
          idempotencyKey: 'idem-1',
        }),
      }),
    );
    expect(result).toMatchObject({
      payment_id: payment.id,
      product_type: 'single_unlock',
      amount: 49000,
      status: 'pending',
      vietqr: {
        transfer_content: payment.providerReference,
      },
      entitlement: {
        kind: 'profile_unlock',
        tutor_profile_id: payment.targetRefId,
        active: false,
      },
    });
    expect(result.vietqr.qr_url).toContain('img.vietqr.io/image/VCB-123456789');
  });

  it('rejects an idempotency key reused with another checkout payload', async () => {
    const prisma = {
      tutorProfile: { findFirst: jest.fn().mockResolvedValue({ id: payment.targetRefId }) },
      profileUnlock: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: { findFirst: jest.fn().mockResolvedValue(payment) },
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({ responseHash: 'different' }),
      },
    };
    const service = new BillingService(prisma as any, config() as any, {} as any);

    await expect(
      service.checkout(
        user as any,
        { product_type: 'single_unlock', target_ref_id: payment.targetRefId },
        'idem-1',
      ),
    ).rejects.toMatchObject({ code: ErrorCode.IDEMPOTENCY_CONFLICT });
  });

  it('rejects a duplicate subscription checkout while another one is pending payment', async () => {
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-pending' }),
      },
      payment: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new BillingService(prisma as any, config() as any, {} as any);

    await expect(
      service.checkout(
        user as any,
        { product_type: 'parent_vip' },
        'vip-idem-1',
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: {
        userId: user.userId,
        type: 'parent_vip_unlock',
        status: { in: ['pending_payment', 'active', 'past_due'] },
        OR: [
          { status: 'pending_payment' },
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: expect.any(Date) } },
        ],
      },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('processes a SePay webhook and grants a profile unlock once', async () => {
    const paidPayment = { ...payment, status: 'paid', paidAt: new Date() };
    const tx = {
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'webhook-1' }),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue(paidPayment),
      },
      parentProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: user.parentProfileId }),
      },
      profileUnlock: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const outbox = { emit: jest.fn() };
    const service = new BillingService(prisma as any, config() as any, outbox as any);

    const result = await service.handleSepayWebhook(
      {
        content: `Thanh toan ${payment.providerReference}`,
        amount: '49000',
        id: 'bank-txn-1',
      },
      {},
      '127.0.0.1',
    );

    expect(result).toMatchObject({ received: true, payment_id: payment.id, status: 'paid' });
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: payment.id },
        data: expect.objectContaining({ status: 'paid' }),
      }),
    );
    expect(tx.profileUnlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentProfileId: user.parentProfileId,
          tutorProfileId: payment.targetRefId,
          paymentId: payment.id,
          status: 'active',
        }),
      }),
    );
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'payment',
        aggregateId: payment.id,
        eventType: 'payment.paid',
      }),
    );
  });
});
