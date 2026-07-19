import { AccessService } from './access.service';
import { ErrorCode } from '../errors/error-codes';

describe('AccessService tutor QR capability', () => {
  it('uses an active admin override without querying subscriptions', async () => {
    const prisma = { subscription: { findFirst: jest.fn() } };
    const paidFeatures = { overrideState: jest.fn().mockResolvedValue(true) };
    const service = new AccessService(prisma as any, paidFeatures as any);

    await expect(service.hasTutorQrAccess('user-1')).resolves.toBe(true);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed when an admin override disables the feature', async () => {
    const prisma = { subscription: { findFirst: jest.fn() } };
    const paidFeatures = { overrideState: jest.fn().mockResolvedValue(false) };
    const service = new AccessService(prisma as any, paidFeatures as any);

    await expect(service.hasTutorQrAccess('user-1')).resolves.toBe(false);
    await expect(service.assertTutorQr('user-1')).rejects.toMatchObject({
      code: ErrorCode.SUBSCRIPTION_EXPIRED,
    });
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to a non-expired active subscription when there is no override', async () => {
    const prisma = {
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
    };
    const paidFeatures = { overrideState: jest.fn().mockResolvedValue(null) };
    const service = new AccessService(prisma as any, paidFeatures as any);

    await expect(service.hasTutorQrAccess('user-1')).resolves.toBe(true);
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 'user-1',
        type: 'tutor_qr',
        status: 'active',
      }),
      select: { id: true },
    });
  });
});
