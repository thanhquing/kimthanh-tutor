import { ConsentService } from './consent.service';
import { ErrorCode } from '../../common/errors/error-codes';

function config(storeIp = true, storeUserAgent = true) {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        'consent.storeIp': storeIp,
        'consent.storeUserAgent': storeUserAgent,
      };
      return values[key];
    }),
  };
}

describe('ConsentService', () => {
  it('returns active legal documents in API shape', async () => {
    const publishedAt = new Date('2026-01-01T00:00:00Z');
    const prisma = {
      legalDocument: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'terms-1',
            docType: 'terms',
            version: 'v1',
            title: 'Terms',
            contentUrl: 'https://example.test/terms',
            checksum: 'abc',
            publishedAt,
          })
          .mockResolvedValueOnce({
            id: 'privacy-1',
            docType: 'privacy',
            version: 'v1',
            title: 'Privacy',
            contentUrl: 'https://example.test/privacy',
            checksum: 'def',
            publishedAt,
          }),
      },
    };
    const service = new ConsentService(prisma as any, config() as any);

    await expect(service.activeDocuments()).resolves.toEqual({
      terms: expect.objectContaining({
        id: 'terms-1',
        doc_type: 'terms',
        published_at: publishedAt.toISOString(),
      }),
      privacy: expect.objectContaining({
        id: 'privacy-1',
        doc_type: 'privacy',
      }),
    });
  });

  it('requires the user to reach the bottom before recording consent', async () => {
    const service = new ConsentService({} as any, config() as any);

    await expect(
      service.recordConsent(
        'user-1',
        {
          terms_document_id: 'terms-1',
          privacy_document_id: 'privacy-1',
          scroll_reached_bottom: false,
          consent_method: 'checkbox',
        },
        {},
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('records consent and activates a pending user with configured IP/UA storage', async () => {
    const user = {
      id: 'user-1',
      roles: ['parent'],
      status: 'pending_consent',
      deletedAt: null,
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      legalDocument: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'terms-1' })
          .mockResolvedValueOnce({ id: 'privacy-1' }),
      },
      legalConsent: {
        create: jest.fn().mockResolvedValue({ id: 'consent-1' }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new ConsentService(prisma as any, config(true, true) as any);

    const result = await service.recordConsent(
      'user-1',
      {
        terms_document_id: 'terms-1',
        privacy_document_id: 'privacy-1',
        scroll_reached_bottom: true,
        consent_method: 'checkbox',
      },
      { ip: '1.2.3.4', userAgent: 'jest' },
    );

    expect(prisma.legalConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        roleAtAcceptance: 'parent',
        termsDocumentId: 'terms-1',
        privacyDocumentId: 'privacy-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      }),
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', status: 'pending_consent' },
      data: { status: 'active' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
    ]);
    expect(result).toEqual({ ok: true, user_status: 'active' });
  });

  it('is idempotent for an already active user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          roles: ['parent'],
          status: 'active',
          deletedAt: null,
        }),
      },
      legalDocument: { findFirst: jest.fn() },
      legalConsent: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new ConsentService(prisma as any, config() as any);

    const result = await service.recordConsent(
      'user-1',
      {
        terms_document_id: 'terms-1',
        privacy_document_id: 'privacy-1',
        scroll_reached_bottom: true,
        consent_method: 'checkbox',
      },
      {},
    );

    expect(result).toEqual({ ok: true, user_status: 'active' });
    expect(prisma.legalConsent.create).not.toHaveBeenCalled();
  });
});
