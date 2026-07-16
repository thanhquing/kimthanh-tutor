import type { PrismaClient } from '@prisma/client';
import { setAdminPassword } from './set-admin-password';

describe('setAdminPassword', () => {
  it('rotates the hash and revokes every active refresh token atomically', async () => {
    const tx = {
      adminCredential: { upsert: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          roles: ['admin'],
          status: 'active',
          deletedAt: null,
        }),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    } as unknown as PrismaClient;

    await setAdminPassword(prisma, ' Admin@Example.Test ', 'correct-password');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.test' },
    });
    expect(tx.adminCredential.upsert).toHaveBeenCalledWith({
      where: { userId: 'admin-1' },
      create: { userId: 'admin-1', passwordHash: expect.stringMatching(/^scrypt\$/) },
      update: {
        passwordHash: expect.stringMatching(/^scrypt\$/),
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: expect.any(Date),
      },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'admin-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
