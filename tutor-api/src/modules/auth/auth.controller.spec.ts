import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

function config(env = 'test') {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        env,
        apiPrefix: 'api/v1',
        'jwt.refreshTtl': 1_209_600,
      };
      return values[key];
    }),
  } as unknown as ConfigService;
}

function response() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

describe('AuthController admin cookie session', () => {
  it('moves the refresh token into an HttpOnly cookie on password login', async () => {
    const auth = {
      adminPasswordLogin: jest.fn().mockResolvedValue({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: 'admin-1',
          phone: null,
          email: 'admin@example.test',
          status: 'active',
        },
        consent_required: false,
      }),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config('production'));
    const res = response();

    const result = await controller.adminPassword(
      { email: 'admin@example.test', password: 'correct-password' },
      '1.2.3.4',
      res,
    );

    expect(result).toEqual({
      access_token: 'access-token',
      user: {
        id: 'admin-1',
        phone: null,
        email: 'admin@example.test',
        status: 'active',
      },
      consent_required: false,
    });
    expect(res.cookie).toHaveBeenCalledWith('kt_admin_refresh', 'refresh-token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/api/v1/auth/admin',
      maxAge: 1_209_600_000,
    });
  });

  it('rotates the cookie without exposing the refresh token', async () => {
    const auth = {
      refreshAdmin: jest.fn().mockResolvedValue({
        access_token: 'next-access',
        refresh_token: 'next-refresh',
      }),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const req = {
      headers: { cookie: 'other=x; kt_admin_refresh=current%3Drefresh' },
    } as Request;
    const res = response();

    await expect(controller.adminRefresh(req, '1.2.3.4', res)).resolves.toEqual({
      access_token: 'next-access',
    });
    expect(auth.refreshAdmin).toHaveBeenCalledWith('current=refresh', '1.2.3.4');
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      'kt_admin_refresh',
      'next-refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('keeps a valid cookie when refresh fails with a transient server error', async () => {
    const auth = {
      refreshAdmin: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const req = { headers: { cookie: 'kt_admin_refresh=current' } } as Request;
    const res = response();

    await expect(controller.adminRefresh(req, '1.2.3.4', res)).rejects.toThrow(
      'database unavailable',
    );
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('clears an invalid admin refresh cookie', async () => {
    const auth = {
      refreshAdmin: jest.fn().mockRejectedValue(
        new AppException(ErrorCode.AUTH_REQUIRED, 'Phiên admin không hợp lệ'),
      ),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const req = { headers: { cookie: 'kt_admin_refresh=invalid' } } as Request;
    const res = response();

    await expect(controller.adminRefresh(req, '1.2.3.4', res)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'kt_admin_refresh',
      expect.objectContaining({ path: '/api/v1/auth/admin' }),
    );
  });

  it('revokes the refresh token and clears the cookie on logout', async () => {
    const auth = { revokeRefreshToken: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const req = {
      headers: { cookie: 'kt_admin_refresh=refresh-token' },
    } as Request;
    const res = response();

    await controller.adminLogout(req, res);

    expect(auth.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'kt_admin_refresh',
      expect.objectContaining({ path: '/api/v1/auth/admin' }),
    );
  });
});
