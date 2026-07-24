import { QrService } from './qr.service';
import { ErrorCode } from '../../common/errors/error-codes';

const now = new Date('2026-01-01T00:00:00Z');
const tutor = { id: 'tutor-1' };
const payout = {
  id: 'payout-1',
  tutorProfileId: tutor.id,
  bankCode: 'VCB',
  accountNumber: '123456789',
  accountHolder: 'CO LINH',
};
const record = {
  id: 'qr-1',
  tutorProfileId: tutor.id,
  classContractId: 'class-1',
  payoutAccountId: payout.id,
  amount: 200_000n,
  description: 'Hoc phi thang 1',
  qrUrl: 'https://img.vietqr.io/image/VCB-123456789-compact2.png',
  paymentLink: 'https://img.vietqr.io/image/VCB-123456789-compact2.png',
  collectionStatus: 'created',
  markedCollectedAt: null,
  createdAt: now,
};

describe('QrService', () => {
  it('creates a tutor-owned QR record when tutor_qr subscription is active', async () => {
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(tutor) },
      tutorPayoutAccount: { findFirst: jest.fn().mockResolvedValue(payout) },
      classContract: { findFirst: jest.fn().mockResolvedValue({ id: 'class-1' }) },
      tutorPaymentQrRecord: { create: jest.fn().mockResolvedValue(record) },
    };
    const access = { assertTutorQr: jest.fn().mockResolvedValue(undefined) };
    const service = new QrService(prisma as any, access as any);

    const result = await service.create('user-1', {
      class_contract_id: 'class-1',
      payout_account_id: payout.id,
      amount: 200000,
      description: 'Hoc phi thang 1',
    });

    expect(access.assertTutorQr).toHaveBeenCalledWith('user-1');
    expect(prisma.tutorPaymentQrRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tutorProfileId: tutor.id,
          payoutAccountId: payout.id,
          amount: 200_000n,
          qrUrl: expect.stringContaining('img.vietqr.io/image/VCB-123456789'),
        }),
      }),
    );
    expect(result).toMatchObject({
      id: record.id,
      amount: 200000,
      transfer_content: 'Hoc phi thang 1',
      collection_status: 'created',
    });
  });

  it('marks a QR record collected for its owner', async () => {
    const updated = {
      ...record,
      collectionStatus: 'marked_collected',
      markedCollectedAt: new Date('2026-01-02T00:00:00Z'),
    };
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(tutor) },
      tutorPaymentQrRecord: {
        findFirst: jest.fn().mockResolvedValue(record),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const service = new QrService(prisma as any, {} as any);

    const result = await service.markCollected('user-1', record.id);

    expect(prisma.tutorPaymentQrRecord.update).toHaveBeenCalledWith({
      where: { id: record.id },
      data: expect.objectContaining({ collectionStatus: 'marked_collected' }),
    });
    expect(result.collection_status).toBe('marked_collected');
  });

  it('fails closed when a tutor tries to create a QR with another tutor payout account', async () => {
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(tutor) },
      tutorPayoutAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new QrService(prisma as any, { assertTutorQr: jest.fn() } as any);

    await expect(service.create('user-1', {
      payout_account_id: 'foreign-payout',
      amount: 200_000,
    })).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
    expect(prisma.tutorPayoutAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-payout', tutorProfileId: tutor.id },
    });
  });
});
