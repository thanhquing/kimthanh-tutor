import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { hashPassword, sha256 } from '../../common/utils/hash.util';

function config() {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        env: 'test',
        'jwt.accessSecret': 'access-secret',
        'jwt.accessTtl': 900,
        'jwt.refreshTtl': 1_209_600,
        'oauth.googleClientId': 'google-client-id',
        'oauth.facebookAppId': 'facebook-app-id',
        'oauth.facebookAppSecret': 'facebook-secret',
        'password.minLength': 8,
        'password.maxLength': 128,
        'mail.appBaseUrl': 'http://localhost:5173',
        'mail.verifyTtlSeconds': 86_400,
        'mail.resetTtlSeconds': 3_600,
      };
      return values[key];
    }),
  } as unknown as ConfigService;
}

function mail() {
  return {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };
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
    const service = new AuthService(prisma as any, jwt as any, config(), mail() as any);

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
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.adminPasswordLogin('admin@example.test', 'wrong-password')).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
      message: 'Email hoặc mật khẩu không đúng',
    });
    expect(prisma.adminCredential.updateMany).toHaveBeenCalledWith({
      where: { userId: 'admin-1', failedAttempts: 4, lockedUntil: null },
      data: { failedAttempts: 5, lockedUntil: expect.any(Date) },
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
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.adminPasswordLogin('parent@example.test', 'correct-password')).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN_ROLE,
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('registers a gmail user as pending_verification and returns a dev verify link', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'new@gmail.com', status: 'pending_verification' }),
      },
      userCredential: { upsert: jest.fn() },
      emailToken: { updateMany: jest.fn(), create: jest.fn() },
    };
    const mailSvc = mail();
    const service = new AuthService(prisma as any, {} as JwtService, config(), mailSvc as any);

    const result = await service.register(' New@Gmail.com ', 'a-strong-password');

    expect(prisma.userCredential.upsert).toHaveBeenCalled();
    expect(prisma.emailToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', type: 'verify', tokenHash: expect.any(String) }),
    });
    expect(mailSvc.sendVerificationEmail).toHaveBeenCalledWith('new@gmail.com', expect.stringContaining('/verify-email?token='));
    expect(result).toMatchObject({
      verification_required: true,
      user: { status: 'pending_verification' },
      dev_verification_link: expect.stringContaining('/verify-email?token='),
    });
  });

  it('rejects registration from a non gmail/edu domain', async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.register('someone@yahoo.com', 'a-strong-password')).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('accepts an .edu.vn domain and rejects a duplicate active email', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u', deletedAt: null }) },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.register('sv@hcmus.edu.vn', 'a-strong-password')).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it('blocks login for an unverified email', async () => {
    const passwordHash = await hashPassword('correct-password');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({
        id: 'user-1', email: 'p@gmail.com', status: 'pending_verification',
        emailVerifiedAt: null, deletedAt: null,
        userCredential: { userId: 'user-1', passwordHash, failedAttempts: 0, lockedUntil: null },
      }) },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.login('p@gmail.com', 'correct-password')).rejects.toMatchObject({
      code: ErrorCode.EMAIL_NOT_VERIFIED,
    });
  });

  it('logs in a verified user and issues tokens', async () => {
    const passwordHash = await hashPassword('correct-password');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({
        id: 'user-1', phone: null, email: 'p@gmail.com', status: 'active',
        emailVerifiedAt: new Date(), deletedAt: null,
        userCredential: { userId: 'user-1', passwordHash, failedAttempts: 1, lockedUntil: null },
      }) },
      userCredential: { update: jest.fn() },
      refreshToken: { create: jest.fn() },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const service = new AuthService(prisma as any, jwt as any, config(), mail() as any);

    const result = await service.login('P@Gmail.com', 'correct-password', '1.2.3.4');

    expect(prisma.userCredential.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    expect(result).toMatchObject({
      access_token: 'access-token',
      user: { id: 'user-1', email: 'p@gmail.com', status: 'active' },
      consent_required: false,
    });
  });

  it('verifies email and moves account to pending_consent', async () => {
    const raw = 'verify-token';
    const prisma = {
      emailToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'et-1', userId: 'user-1', type: 'verify',
          tokenHash: sha256(raw), consumedAt: null, expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', status: 'pending_verification', emailVerifiedAt: null, deletedAt: null }),
        update: jest.fn(),
      },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.verifyEmail(raw)).resolves.toEqual({ verified: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { emailVerifiedAt: expect.any(Date), status: 'pending_consent' },
    });
  });

  it('rejects an already consumed verify token', async () => {
    const raw = 'verify-token';
    const prisma = {
      emailToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'et-1', userId: 'user-1', type: 'verify',
          tokenHash: sha256(raw), consumedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.verifyEmail(raw)).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('sends a reset link only when a credential exists, always returning ok', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', deletedAt: null, userCredential: { userId: 'user-1' } }) },
      emailToken: { updateMany: jest.fn(), create: jest.fn() },
    };
    const mailSvc = mail();
    const service = new AuthService(prisma as any, {} as JwtService, config(), mailSvc as any);

    const result = await service.forgotPassword('p@gmail.com');
    expect(mailSvc.sendPasswordResetEmail).toHaveBeenCalledWith('p@gmail.com', expect.stringContaining('/reset-password?token='));
    expect(result).toMatchObject({ ok: true, dev_reset_link: expect.stringContaining('/reset-password?token=') });

    const missing = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const mailSvc2 = mail();
    const service2 = new AuthService(missing as any, {} as JwtService, config(), mailSvc2 as any);
    await expect(service2.forgotPassword('nobody@gmail.com')).resolves.toEqual({ ok: true });
    expect(mailSvc2.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resets the password and revokes all live refresh tokens', async () => {
    const raw = 'reset-token';
    const tx = {
      userCredential: { upsert: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    const prisma = {
      emailToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'et-1', userId: 'user-1', type: 'reset',
          tokenHash: sha256(raw), consumedAt: null, expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.resetPassword(raw, 'a-new-strong-password')).resolves.toEqual({ ok: true });
    expect(tx.userCredential.upsert).toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('verifies a Google ID token, links auth account, creates pending user, and issues tokens', async () => {
    const user = {
      id: 'user-google', phone: null, email: 'parent@example.com',
      status: 'pending_consent', deletedAt: null,
    };
    const tx = {
      authAccount: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(user) },
    };
    const prisma = {
      $transaction: jest.fn((fn) => fn(tx)),
      refreshToken: { create: jest.fn() },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'google-user-1', aud: 'google-client-id', email: 'Parent@Example.com',
        email_verified: 'true', name: 'Parent One', picture: 'https://example.test/avatar.png',
      }),
    } as Response);
    const service = new AuthService(prisma as any, jwt as any, config(), mail() as any);

    const result = await service.oauthLogin('google', 'id-token', '1.2.3.4');

    expect(fetchMock).toHaveBeenCalledWith('https://oauth2.googleapis.com/tokeninfo?id_token=id-token');
    expect(tx.authAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: 'google', providerUserId: 'google-user-1', emailVerified: true }),
    });
    expect(result).toMatchObject({ access_token: 'access-token', auth_provider: 'google', consent_required: true });
  });

  it('revokes active sibling refresh tokens when a revoked token is reused', async () => {
    const raw = 'refresh-token';
    const record = {
      id: 'rt-1', userId: 'user-1', tokenHash: sha256(raw),
      revokedAt: new Date('2026-01-01T00:00:00Z'), expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', roles: ['parent'], status: 'active', deletedAt: null },
    };
    const tx = { refreshToken: { findUnique: jest.fn().mockResolvedValue(record), updateMany: jest.fn() } };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new AuthService(prisma as any, {} as any, config(), mail() as any);

    await expect(service.refresh(raw)).rejects.toMatchObject({ code: ErrorCode.AUTH_REQUIRED });
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
    const service = new AuthService(prisma as any, jwt as any, config(), mail() as any);

    await expect(service.refreshAdmin(raw, '1.2.3.4')).resolves.toMatchObject({
      access_token: 'next-access', refresh_token: expect.any(String),
    });
    expect(tx.refreshToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.create.mock.invocationCallOrder[0],
    );
    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' }, data: { rotatedToId: expect.any(String) },
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
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.refreshAdmin('refresh-token')).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
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
    const service = new AuthService(prisma as any, {} as JwtService, config(), mail() as any);

    await expect(service.refreshAdmin('refresh-token')).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
