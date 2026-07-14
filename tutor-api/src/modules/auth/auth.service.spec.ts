import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { hashOtp, sha256 } from '../../common/utils/hash.util';

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
    };
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(record),
        updateMany: jest.fn(),
      },
    };
    const service = new AuthService(prisma as any, {} as any, config());

    await expect(service.refresh(raw)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
