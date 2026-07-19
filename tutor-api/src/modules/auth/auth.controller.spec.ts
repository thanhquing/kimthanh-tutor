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

describe('AuthController public session cookie', () => {
  const summary = { id: 'user-1', phone: null, email: 'p@gmail.com', status: 'active' as const };

  it('moves the refresh token into an HttpOnly cookie on login', async () => {
    const auth = {
      login: jest.fn().mockResolvedValue({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: summary,
        consent_required: false,
      }),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config('production'));
    const res = response();

    const result = await controller.login(
      { email: 'p@gmail.com', password: 'a-strong-password' },
      '1.2.3.4',
      res,
    );

    expect(result).toEqual({ access_token: 'access-token', user: summary, consent_required: false });
    expect(result).not.toHaveProperty('refresh_token');
    expect(res.cookie).toHaveBeenCalledWith('kt_refresh', 'refresh-token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/api/v1/auth',
      maxAge: 1_209_600_000,
    });
  });

  it('sets the session cookie on OAuth login without exposing the refresh token', async () => {
    const auth = {
      oauthLogin: jest.fn().mockResolvedValue({
        access_token: 'oauth-access',
        refresh_token: 'oauth-refresh',
        user: summary,
        auth_provider: 'google',
        consent_required: true,
      }),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const res = response();

    const result = await controller.googleOAuth({ id_token: 'id-token' }, '1.2.3.4', res);

    expect(result).toEqual({ access_token: 'oauth-access', user: summary, consent_required: true });
    expect(result).not.toHaveProperty('refresh_token');
    expect(res.cookie).toHaveBeenCalledWith(
      'kt_refresh',
      'oauth-refresh',
      expect.objectContaining({ path: '/api/v1/auth' }),
    );
  });

  it('rotates the cookie from the refresh cookie and returns only the access token', async () => {
    const auth = {
      refresh: jest.fn().mockResolvedValue({ access_token: 'next-access', refresh_token: 'next-refresh' }),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const req = { headers: { cookie: 'other=x; kt_refresh=current%3Drefresh' } } as Request;
    const res = response();

    await expect(controller.refresh(req, '1.2.3.4', res)).resolves.toEqual({ access_token: 'next-access' });
    expect(auth.refresh).toHaveBeenCalledWith('current=refresh', '1.2.3.4');
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      'kt_refresh',
      'next-refresh',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('keeps the cookie on a rotate conflict (409) but clears it when the session is invalid', async () => {
    const conflicting = {
      refresh: jest.fn().mockRejectedValue(new AppException(ErrorCode.CONFLICT, 'Đang làm mới')),
    } as unknown as AuthService;
    const controller = new AuthController(conflicting, config());
    const req = { headers: { cookie: 'kt_refresh=current' } } as Request;
    const res = response();
    await expect(controller.refresh(req, '1.2.3.4', res)).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(res.clearCookie).not.toHaveBeenCalled();

    const invalid = {
      refresh: jest.fn().mockRejectedValue(new AppException(ErrorCode.AUTH_REQUIRED, 'Phiên bị thu hồi')),
    } as unknown as AuthService;
    const controller2 = new AuthController(invalid, config());
    const res2 = response();
    await expect(controller2.refresh(req, '1.2.3.4', res2)).rejects.toMatchObject({ code: ErrorCode.AUTH_REQUIRED });
    expect(res2.clearCookie).toHaveBeenCalledWith('kt_refresh', expect.objectContaining({ path: '/api/v1/auth' }));
  });

  it('revokes the user refresh token from the cookie and clears it on logout', async () => {
    const auth = { revokeRefreshToken: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const req = { headers: { cookie: 'kt_refresh=user-refresh-token' } } as Request;
    const res = response();

    await controller.logout(req, res);

    expect(auth.revokeRefreshToken).toHaveBeenCalledWith('user-refresh-token');
    expect(res.clearCookie).toHaveBeenCalledWith('kt_refresh', expect.objectContaining({ path: '/api/v1/auth' }));
  });
});
