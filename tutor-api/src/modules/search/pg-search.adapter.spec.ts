import { PgSearchAdapter } from './pg-search.adapter';
import { encodeCursor } from '../../common/pagination/keyset';
import { ErrorCode } from '../../common/errors/error-codes';

const publishedAt = new Date('2026-01-01T00:00:00Z');
const row = (id: string, ratingAvg: number, fee: bigint | null = 100_000n) => ({
  id,
  displayName: `Tutor ${id}`,
  avatarMediaId: null,
  region: 'hcm',
  educationLevel: 'university',
  schoolName: 'HCMUS',
  bio: 'A'.repeat(200),
  expectedFeeMin: fee,
  expectedFeeMax: fee ? fee + 50_000n : null,
  ratingAvg,
  ratingCount: 3,
  publishedAt,
  subjects: [{ subjectCode: 'math' }],
  gradeLevels: [{ gradeLevel: 6 }],
  teachingModes: [{ mode: 'online' }],
});

describe('PgSearchAdapter', () => {
  it('builds normalized filters, keyset pagination, and maps tutor cards', async () => {
    const rows = [row('tutor-2', 4.9), row('tutor-1', 4.7)];
    const prisma = {
      tutorProfile: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    const service = new PgSearchAdapter(prisma as any);

    const result = await service.search({
      subject: 'math',
      grade_level: 6,
      teaching_mode: 'online',
      province_code: '79',
      district_code: '760',
      fee_min: 50_000,
      fee_max: 200_000,
      sort: 'rating',
      limit: '1',
    });

    expect(prisma.tutorProfile.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'published',
        deletedAt: null,
        subjects: { some: { subjectCode: 'math' } },
        gradeLevels: { some: { gradeLevel: 6 } },
        teachingModes: { some: { mode: 'online' } },
        offlineAreas: {
          some: { provinceCode: '79', districtCode: '760' },
        },
        expectedFeeMin: { lte: 200_000n },
        expectedFeeMax: { gte: 50_000n },
      }),
      orderBy: [{ ratingAvg: 'desc' }, { id: 'desc' }],
      take: 2,
      select: expect.any(Object),
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'tutor-2',
          display_name: 'Tutor tutor-2',
          subjects: ['math'],
          grade_levels: [6],
          teaching_modes: ['online'],
          fee_min: 100000,
          fee_max: 150000,
          bio_snippet: 'A'.repeat(160),
        }),
      ],
      next_cursor: encodeCursor(4.9, 'tutor-2'),
    });
  });

  it('rejects invalid cursors', async () => {
    const service = new PgSearchAdapter({ tutorProfile: { findMany: jest.fn() } } as any);

    await expect(
      service.search({ cursor: 'not-base64-json', sort: 'rating' }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('rejects impossible fee ranges before querying', async () => {
    const prisma = { tutorProfile: { findMany: jest.fn() } };
    const service = new PgSearchAdapter(prisma as any);

    await expect(
      service.search({ fee_min: 300_000, fee_max: 100_000 }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: { fee_min: 300_000, fee_max: 100_000 },
    });
    expect(prisma.tutorProfile.findMany).not.toHaveBeenCalled();
  });

  it('applies fee_asc cursor semantics including nullable fee group', async () => {
    const cursor = encodeCursor(null, 'tutor-null-1');
    const prisma = {
      tutorProfile: { findMany: jest.fn().mockResolvedValue([row('tutor-null-2', 5, null)]) },
    };
    const service = new PgSearchAdapter(prisma as any);

    await service.search({ sort: 'fee_asc', cursor, limit: '10' });

    expect(prisma.tutorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expectedFeeMin: null,
          id: { gt: 'tutor-null-1' },
        }),
        orderBy: [{ expectedFeeMin: 'asc' }, { id: 'asc' }],
      }),
    );
  });
});
