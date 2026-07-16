import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { hashOtp, hashPassword, sha256 } from '../../common/utils/hash.util';

function config() {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        env: 'test',
        'otp.ttlSeconds': 300,
        'otp.maxAttempts': 5,
        'jwt.accessSecret': 'access-secret',
        'jwt.accessTtl': 900,
        'jwt.refreshTtl': 1_209_600,
        'oauth.googleClientId': 'google-client-id',
        'oauth.facebookAppId': 'facebook-app-id',
        'oauth.facebookAppSecret': 'facebook-secret',
      };
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    if (!global.fetch) {
      Object.defineProperty(global, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(),
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs in an active admin with a valid scrypt password', async () => {
    const passwordHash = await hashPassword('correct-password');
    const credential = { userId: 'admin-1', passwordHash, failedAttempts: 2, lockedUntil: null };
    const user = {
      id: 'admin-1', phone: null, email: 'admin@example.test', roles: ['admin'],
      status: 'active', deletedAt: null, adminCredential: credential,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      adminCredential: { update: jest.fn() },
      refreshToken: { create: jest.fn() },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const service = new AuthService(prisma as any, jwt as any, config());

    const result = await service.adminPasswordLogin(' Admin@Example.Test ', 'correct-password', '1.2.3.4');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.test' },
      include: { adminCredential: true },
    });
    expect(prisma.adminCredential.update).toHaveBeenCalledWith({
      where: { userId: 'admin-1' },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    expect(result).toMatchObject({ access_token: 'access-token', user: { id: 'admin-1' }, consent_required: false });
  });

  it('increments failures and rejects an invalid admin password generically', async () => {
    const credential = {
      userId: 'admin-1', passwordHash: await hashPassword('correct-password'),
      failedAttempts: 4, lockedUntil: null,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', adminCredential: credential }) },
      adminCredential: {
        findUnique: jest.fn().mockResolvedValue({ failedAttempts: 4, lockedUntil: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config());

    await expect(service.adminPasswordLogin('admin@example.test', 'wrong-password')).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
      message: 'Email hoặc mật khẩu không đúng',
    });
    expect(prisma.adminCredential.updateMany).toHaveBeenCalledWith({
      where: { userId: 'admin-1', failedAttempts: 4, lockedUntil: null },
      data: { failedAttempts: 5, lockedUntil: expect.any(Date) },
    });
  });

  it('retries a contended admin failure increment instead of losing it', async () => {
    const credential = {
      userId: 'admin-1', passwordHash: await hashPassword('correct-password'),
      failedAttempts: 2, lockedUntil: null,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', adminCredential: credential }) },
      adminCredential: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ failedAttempts: 2, lockedUntil: null })
          .mockResolvedValueOnce({ failedAttempts: 3, lockedUntil: null }),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config());

    await expect(service.adminPasswordLogin('admin@example.test', 'wrong-password')).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });
    expect(prisma.adminCredential.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 'admin-1', failedAttempts: 3, lockedUntil: null },
      data: { failedAttempts: 4, lockedUntil: null },
    });
  });

  it('does not issue tokens when a valid credential no longer has admin role', async () => {
    const credential = {
      userId: 'user-1', passwordHash: await hashPassword('correct-password'),
      failedAttempts: 0, lockedUntil: null,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({
        id: 'user-1', roles: ['parent'], status: 'active', deletedAt: null, adminCredential: credential,
      }) },
      adminCredential: { update: jest.fn() },
      refreshToken: { create: jest.fn() },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config());

    await expect(service.adminPasswordLogin('parent@example.test', 'correct-password')).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN_ROLE,
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('creates an OTP request with normalized destination and returns dev code outside production', async () => {
    const prisma = {
      otpRequest: { create: jest.fn() },
    };
    const service = new AuthService(
      prisma as any,
      {} as JwtService,
      config(),
    );

    const result = await service.requestOtp('email', '  Parent@Example.COM  ', '1.2.3.4');

    expect(prisma.otpRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'email',
        destination: 'parent@example.com',
        codeHash: expect.any(String),
        requestIp: '1.2.3.4',
      }),
    });
    expect(result).toMatchObject({
      request_id: expect.any(String),
      expires_at: expect.any(String),
      dev_code: '272727',
    });
  });

  it('verifies an SMS OTP atomically, creates pending user, and issues tokens', async () => {
    const otp = {
      id: 'otp-1',
      channel: 'sms',
      destination: '0900000000',
      codeHash: hashOtp('123456', 'otp-1'),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    };
    const user = {
      id: 'user-1',
      phone: otp.destination,
      status: 'pending_consent',
      deletedAt: null,
    };
    const prisma = {
      otpRequest: {
        findUnique: jest.fn().mockResolvedValue(otp),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user),
      },
      refreshToken: { create: jest.fn() },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const service = new AuthService(prisma as any, jwt as any, config());

    const result = await service.verifyOtp('otp-1', '123456', '5.6.7.8');

    expect(prisma.otpRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'otp-1', consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '0900000000',
        roles: [],
        status: 'pending_consent',
      }),
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tokenHash: expect.any(String),
        createdIp: '5.6.7.8',
      }),
    });
    expect(result).toMatchObject({
      access_token: 'access-token',
      refresh_token: expect.any(String),
      user: { id: 'user-1', phone: '0900000000', status: 'pending_consent' },
      consent_required: true,
    });
  });

  it('verifies a Google ID token, links auth account, creates pending user, and issues tokens', async () => {
    const user = {
      id: 'user-google',
      phone: null,
      email: 'parent@example.com',
      status: 'pending_consent',
      deletedAt: null,
    };
    const tx = {
      authAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn) => fn(tx)),
      refreshToken: { create: jest.fn() },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'google-user-1',
          aud: 'google-client-id',
          email: 'Parent@Example.com',
          email_verified: 'true',
          name: 'Parent One',
          picture: 'https://example.test/avatar.png',
        }),
      } as Response);
    const service = new AuthService(prisma as any, jwt as any, config());

    const result = await service.oauthLogin('google', 'id-token', '1.2.3.4');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/tokeninfo?id_token=id-token',
    );
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: null,
        email: 'parent@example.com',
        status: 'pending_consent',
      }),
    });
    expect(tx.authAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        provider: 'google',
        providerUserId: 'google-user-1',
        email: 'parent@example.com',
        emailVerified: true,
      }),
    });
    expect(result).toMatchObject({
      access_token: 'access-token',
      user: {
        id: user.id,
        phone: null,
        email: 'parent@example.com',
        status: 'pending_consent',
      },
      auth_provider: 'google',
      consent_required: true,
    });
  });

  it('increments attempts and rejects wrong OTP code', async () => {
    const otp = {
      id: 'otp-1',
      channel: 'sms',
      destination: '0900000000',
      codeHash: hashOtp('123456', 'otp-1'),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    };
    const prisma = {
      otpRequest: {
        findUnique: jest.fn().mockResolvedValue(otp),
        update: jest.fn(),
      },
    };
    const service = new AuthService(prisma as any, {} as any, config());

    await expect(service.verifyOtp('otp-1', '000000')).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
    expect(prisma.otpRequest.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { attempts: { increment: 1 } },
    });
  });

  it('revokes active sibling refresh tokens when a revoked token is reused', async () => {
    const raw = 'refresh-token';
    const record = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: sha256(raw),
      revokedAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', roles: ['parent'], status: 'active', deletedAt: null },
    };
    const tx = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(record),
        updateMany: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new AuthService(prisma as any, {} as any, config());

    await expect(service.refresh(raw)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('claims a refresh token before creating its rotated child', async () => {
    const raw = 'refresh-token';
    const tx = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rt-1', userId: 'admin-1', revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'admin-1', roles: ['admin'], status: 'active', deletedAt: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const jwt = { signAsync: jest.fn().mockResolvedValue('next-access') };
    const service = new AuthService(prisma as any, jwt as any, config());

    await expect(service.refreshAdmin(raw, '1.2.3.4')).resolves.toMatchObject({
      access_token: 'next-access',
      refresh_token: expect.any(String),
    });
    expect(tx.refreshToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.create.mock.invocationCallOrder[0],
    );
    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { rotatedToId: expect.any(String) },
    });
  });

  it('does not mint a child when another request already claimed the refresh token', async () => {
    const tx = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rt-1', userId: 'admin-1', revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'admin-1', roles: ['admin'], status: 'active', deletedAt: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new AuthService(prisma as any, {} as JwtService, config());

    await expect(service.refreshAdmin('refresh-token')).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('does not revoke the winning token-family for an immediate duplicate refresh', async () => {
    const tx = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rt-1', userId: 'admin-1', rotatedToId: 'rt-2',
          revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'admin-1', roles: ['admin'], status: 'active', deletedAt: null },
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new AuthService(prisma as any, {} as JwtService, config());

    await expect(service.refreshAdmin('refresh-token')).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
