import { TutorsService } from './tutors.service';
import { ErrorCode } from '../../common/errors/error-codes';

const now = new Date('2026-01-01T00:00:00Z');

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tutor-1',
    userId: 'user-1',
    displayName: 'Tutor One',
    bio: 'Experienced math tutor',
    region: 'hcm',
    voiceAccent: null,
    gender: null,
    educationLevel: 'university',
    schoolName: 'HCMUS',
    studentYear: 3,
    examScore: null,
    gpa: null,
    expectedFeeMin: 100_000n,
    expectedFeeMax: 150_000n,
    avatarMediaId: null,
    introVideoMediaId: 'media-video',
    status: 'draft',
    moderationStatus: 'pending',
    ratingAvg: 0,
    ratingCount: 0,
    version: 0,
    publishedAt: null,
    subjects: [{ subjectCode: 'math' }],
    gradeLevels: [{ gradeLevel: 6 }],
    teachingModes: [{ mode: 'online' }],
    offlineAreas: [{ provinceCode: '79', districtCode: null }],
    ...overrides,
  };
}

describe('TutorsService', () => {
  it('creates a tutor profile, grants tutor role, and syncs normalized tables', async () => {
    const created = profile();
    const tx = {
      tutorProfile: { create: jest.fn().mockResolvedValue(created) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ roles: ['parent'] }),
        update: jest.fn(),
      },
      tutorSubject: { deleteMany: jest.fn(), createMany: jest.fn() },
      tutorGradeLevel: { deleteMany: jest.fn(), createMany: jest.fn() },
      tutorTeachingMode: { deleteMany: jest.fn(), createMany: jest.fn() },
      tutorOfflineArea: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const prisma = {
      tutorProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(created),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.upsertProfile(
      { userId: 'user-1', roles: ['parent'], status: 'active' } as any,
      {
        display_name: 'Tutor One',
        bio: 'Experienced math tutor',
        expected_fee_min: 100_000,
        expected_fee_max: 150_000,
        subjects: ['math', 'math'],
        grade_levels: [6, 6],
        teaching_modes: ['online'],
        offline_areas: [{ province_code: '79' }],
      },
    );

    expect(tx.tutorProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        displayName: 'Tutor One',
        expectedFeeMin: 100_000n,
        expectedFeeMax: 150_000n,
      }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { roles: { set: ['parent', 'tutor'] } },
    });
    const createdProfileId = tx.tutorProfile.create.mock.calls[0][0].data.id;
    expect(tx.tutorSubject.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tutorProfileId: createdProfileId, subjectCode: 'math' })],
      skipDuplicates: true,
    });
    expect(tx.tutorGradeLevel.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tutorProfileId: createdProfileId, gradeLevel: 6 })],
      skipDuplicates: true,
    });
    expect(result).toMatchObject({
      id: 'tutor-1',
      display_name: 'Tutor One',
      subjects: ['math'],
      grade_levels: [6],
      teaching_modes: ['online'],
      offline_areas: [{ province_code: '79', district_code: null }],
    });
  });

  it('returns the current tutor profile with normalized fields for management UI', async () => {
    const prisma = {
      tutorProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'tutor-1',
            status: 'draft',
            expectedFeeMin: 100_000n,
            expectedFeeMax: 150_000n,
          })
          .mockResolvedValueOnce(profile()),
      },
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getMyProfile('user-1');

    expect(prisma.tutorProfile.findUnique).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user-1' },
      select: {
        id: true,
        status: true,
        expectedFeeMin: true,
        expectedFeeMax: true,
      },
    });
    expect(result).toMatchObject({
      id: 'tutor-1',
      display_name: 'Tutor One',
      fee_min: 100000,
      fee_max: 150000,
      status: 'draft',
      subjects: ['math'],
      grade_levels: [6],
      teaching_modes: ['online'],
      offline_areas: [{ province_code: '79', district_code: null }],
    });
  });

  it('returns a not found error when the current user has no tutor profile', async () => {
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getMyProfile('user-1')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('rejects publish when required searchable fields are missing', async () => {
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue(
          profile({
            bio: null,
            expectedFeeMin: null,
            _count: { subjects: 0, gradeLevels: 0, teachingModes: 0 },
          }),
        ),
      },
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.publish('user-1')).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: {
        missing: ['bio', 'expected_fee_min', 'subjects', 'grade_levels', 'teaching_modes'],
      },
    });
  });

  it('rejects blank tutor display name after trimming', async () => {
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.upsertProfile(
        { userId: 'user-1', roles: ['tutor'], status: 'active' } as any,
        { display_name: '   ' },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { field: 'display_name' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an impossible fee range on create/update before writing', async () => {
    const prisma = {
      tutorProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'tutor-1',
            status: 'draft',
            expectedFeeMin: 200_000n,
            expectedFeeMax: 300_000n,
          }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.upsertProfile(
        { userId: 'user-1', roles: ['tutor'], status: 'active' } as any,
        {
          display_name: 'Tutor One',
          expected_fee_min: 300_000,
          expected_fee_max: 100_000,
        },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { expected_fee_min: 300_000, expected_fee_max: 100_000 },
    });

    await expect(
      service.updateProfile(
        { userId: 'user-1', roles: ['tutor'], status: 'active' } as any,
        { expected_fee_max: 100_000 },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { expected_fee_min: 200_000, expected_fee_max: 100_000 },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('publishes a complete profile and emits an outbox event', async () => {
    const p = profile({
      _count: { subjects: 1, gradeLevels: 1, teachingModes: 1 },
    });
    const tx = {
      tutorProfile: { update: jest.fn() },
    };
    const prisma = {
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(p) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const outbox = { emit: jest.fn() };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      outbox as any,
    );

    await expect(service.publish('user-1')).resolves.toEqual({
      status: 'published',
    });
    expect(tx.tutorProfile.update).toHaveBeenCalledWith({
      where: { id: 'tutor-1' },
      data: expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
        version: { increment: 1 },
      }),
    });
    expect(outbox.emit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'tutor_profile',
        aggregateId: 'tutor-1',
        eventType: 'tutor_profile.published',
      }),
    );
  });

  it('returns a locked public detail without private media or reviews', async () => {
    const prisma = {
      tutorProfile: {
        findFirst: jest.fn().mockResolvedValue(
          profile({
            status: 'published',
            ratingAvg: 4.8,
            ratingCount: 12,
          }),
        ),
      },
      review: { findMany: jest.fn() },
    };
    const access = { profileUnlockState: jest.fn() };
    const media = { signedReadUrl: jest.fn() };
    const service = new TutorsService(
      prisma as any,
      access as any,
      media as any,
      {} as any,
    );

    const result = await service.publicDetail('tutor-1');

    expect(result).toMatchObject({
      id: 'tutor-1',
      unlock_state: 'locked',
      unlock_via: null,
      paywall: { products: ['single_unlock', 'parent_vip'] },
      bio_snippet: expect.any(String),
    });
    expect(result).not.toHaveProperty('bio');
    expect(result).not.toHaveProperty('reviews');
    expect(prisma.review.findMany).not.toHaveBeenCalled();
    expect(media.signedReadUrl).not.toHaveBeenCalled();
  });

  it('returns full public detail for an unlocked parent viewer', async () => {
    const prisma = {
      tutorProfile: {
        findFirst: jest.fn().mockResolvedValue(
          profile({
            status: 'published',
            introVideoMediaId: 'media-video',
          }),
        ),
      },
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue({ storageKey: 'videos/intro.mp4' }),
      },
      review: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'review-1',
            rating: 5,
            comment: 'Great',
            createdAt: now,
          },
        ]),
      },
    };
    const access = {
      profileUnlockState: jest.fn().mockResolvedValue({
        unlocked: true,
        via: 'vip_subscription',
      }),
    };
    const media = { signedReadUrl: jest.fn().mockReturnValue('signed-url') };
    const service = new TutorsService(
      prisma as any,
      access as any,
      media as any,
      {} as any,
    );

    const result = await service.publicDetail('tutor-1', {
      userId: 'parent-user',
      parentProfileId: 'parent-1',
    } as any);

    expect(access.profileUnlockState).toHaveBeenCalledWith(
      'parent-1',
      'parent-user',
      'tutor-1',
    );
    expect(result).toMatchObject({
      unlock_state: 'unlocked',
      unlock_via: 'vip_subscription',
      bio: 'Experienced math tutor',
      intro_video_url: 'signed-url',
      reviews: [
        {
          id: 'review-1',
          rating: 5,
          comment: 'Great',
          created_at: now.toISOString(),
        },
      ],
    });
  });

  it('lists payout accounts with masked account numbers for the tutor UI', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const updatedAt = new Date('2026-01-02T00:00:00Z');
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tutor-1',
          status: 'draft',
          expectedFeeMin: null,
          expectedFeeMax: null,
        }),
      },
      tutorPayoutAccount: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'payout-1',
            bankCode: 'VCB',
            accountNumber: '1234567890',
            accountHolder: 'NGUYEN VAN A',
            isDefault: true,
            createdAt,
            updatedAt,
          },
        ]),
      },
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.listPayoutAccounts('user-1');

    expect(prisma.tutorPayoutAccount.findMany).toHaveBeenCalledWith({
      where: { tutorProfileId: 'tutor-1' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(result).toEqual({
      items: [
        {
          id: 'payout-1',
          bank_code: 'VCB',
          account_number_masked: '****7890',
          account_holder: 'NGUYEN VAN A',
          is_default: true,
          created_at: createdAt.toISOString(),
          updated_at: updatedAt.toISOString(),
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('1234567890');
  });

  it('adds a payout account and returns the same safe UI shape as the list endpoint', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    const account = {
      id: 'payout-1',
      tutorProfileId: 'tutor-1',
      bankCode: '970436',
      accountNumber: '1234567890',
      accountHolder: 'NGUYEN THI LINH',
      isDefault: true,
      createdAt,
      updatedAt,
    };
    const tx = {
      tutorPayoutAccount: {
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue(account),
      },
    };
    const prisma = {
      tutorProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tutor-1',
          status: 'draft',
          expectedFeeMin: null,
          expectedFeeMax: null,
        }),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.addPayoutAccount('user-1', {
      bank_code: '970436',
      account_number: '1234567890',
      account_holder: 'NGUYEN THI LINH',
      is_default: true,
    });

    expect(tx.tutorPayoutAccount.updateMany).toHaveBeenCalledWith({
      where: { tutorProfileId: 'tutor-1' },
      data: { isDefault: false },
    });
    expect(result).toEqual({
      id: 'payout-1',
      bank_code: '970436',
      account_number_masked: '****7890',
      account_holder: 'NGUYEN THI LINH',
      is_default: true,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
    });
    expect(JSON.stringify(result)).not.toContain('1234567890');
  });

  it('validates media upload and creates a presigned upload URL contract', async () => {
    const prisma = {
      mediaAsset: { create: jest.fn() },
    };
    const media = {
      validate: jest.fn(),
      storageKeyFor: jest.fn().mockReturnValue('users/user-1/media/avatar'),
      createUploadUrl: jest.fn().mockReturnValue({
        url: 'https://upload.example.test',
        expires_at: '2026-01-01T00:05:00.000Z',
      }),
    };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      media as any,
      {} as any,
    );

    const result = await service.createUploadUrl('user-1', {
      kind: 'avatar',
      content_type: 'image/png',
      size: 1024,
    });

    expect(media.validate).toHaveBeenCalledWith('avatar', 'image/png', 1024);
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerUserId: 'user-1',
        kind: 'avatar',
        storageKey: 'users/user-1/media/avatar',
        contentType: 'image/png',
        sizeBytes: 1024n,
      }),
    });
    expect(result).toEqual({
      media_id: expect.any(String),
      upload_url: 'https://upload.example.test',
      expires_at: '2026-01-01T00:05:00.000Z',
    });
  });

  it('returns owner media status with a signed read URL for own asset', async () => {
    const prisma = {
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'media-1',
          kind: 'avatar',
          contentType: 'image/png',
          moderationStatus: 'pending',
          scanStatus: 'pending',
          storageKey: 'avatar/user-1/media-1',
          createdAt: now,
        }),
      },
    };
    const media = { signedReadUrl: jest.fn().mockReturnValue('signed-read-url') };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      media as any,
      {} as any,
    );

    const result = await service.getMediaStatus('user-1', 'media-1');

    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { id: 'media-1', ownerUserId: 'user-1' },
      select: expect.objectContaining({ storageKey: true }),
    });
    expect(media.signedReadUrl).toHaveBeenCalledWith('avatar/user-1/media-1');
    expect(result).toEqual({
      media_id: 'media-1',
      kind: 'avatar',
      content_type: 'image/png',
      moderation_status: 'pending',
      scan_status: 'pending',
      url: 'signed-read-url',
      created_at: now.toISOString(),
    });
  });

  it('fails closed when the media asset belongs to another owner', async () => {
    const prisma = {
      mediaAsset: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const media = { signedReadUrl: jest.fn() };
    const service = new TutorsService(
      prisma as any,
      {} as any,
      media as any,
      {} as any,
    );

    await expect(
      service.getMediaStatus('user-1', 'media-of-someone-else'),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
    expect(media.signedReadUrl).not.toHaveBeenCalled();
  });
});
