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
        'oauth.returnUrls': ['http://localhost:5174', 'http://localhost:3001'],
      };
      return values[key];
    }),
  } as unknown as ConfigService;
}

function response() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response;
}

function oauthState(parts: { n?: string; r?: string; p?: string }) {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
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

describe('AuthController Google OAuth code flow', () => {
  const summary = { id: 'user-1', phone: null, email: 'p@gmail.com', status: 'active' as const };

  it('start sets a Lax CSRF cookie and redirects to the Google auth URL', () => {
    const auth = {
      buildGoogleAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?x=1'),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config('production'));
    const res = response();

    controller.googleOAuthStart('http://localhost:5174', '/dashboard', res);

    expect(res.cookie).toHaveBeenCalledWith(
      'kt_oauth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: true, path: '/api/v1/auth/oauth/google' }),
    );
    // state truyền cho Google phải nhúng đúng nonce (khớp cookie), base allowlist, next.
    const state = (auth.buildGoogleAuthUrl as jest.Mock).mock.calls[0][0] as string;
    const nonce = (res.cookie as jest.Mock).mock.calls[0][1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    expect(decoded).toEqual({ n: nonce, r: 'http://localhost:5174', p: '/dashboard' });
    expect(res.redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
  });

  it('start falls back to the first allowlisted base for an unknown return_to and sanitizes next', () => {
    const auth = { buildGoogleAuthUrl: jest.fn().mockReturnValue('https://google') } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const res = response();

    controller.googleOAuthStart('https://evil.example', '//evil.example/x', res);

    const state = (auth.buildGoogleAuthUrl as jest.Mock).mock.calls[0][0] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    expect(decoded.r).toBe('http://localhost:5174'); // không dùng origin lạ
    expect(decoded.p).toBe('/'); // "//evil" bị chặn open-redirect
  });

  it('callback exchanges the code, sets the session cookie and redirects back to the FE', async () => {
    const auth = {
      oauthGoogleCode: jest.fn().mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
        user: summary,
        auth_provider: 'google',
        consent_required: false,
      }),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const state = oauthState({ n: 'nonce-1', r: 'http://localhost:5174', p: '/classes' });
    const req = { headers: { cookie: `kt_oauth_state=nonce-1` } } as Request;
    const res = response();

    await controller.googleOAuthCallback('auth-code', state, '', '1.2.3.4', req, res);

    expect(auth.oauthGoogleCode).toHaveBeenCalledWith('auth-code', '1.2.3.4');
    expect(res.cookie).toHaveBeenCalledWith('kt_refresh', 'refresh', expect.objectContaining({ path: '/api/v1/auth' }));
    expect(res.clearCookie).toHaveBeenCalledWith('kt_oauth_state', expect.objectContaining({ path: '/api/v1/auth/oauth/google' }));
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:5174/classes');
  });

  it('callback rejects a state/nonce mismatch (CSRF) without minting a session', async () => {
    const auth = { oauthGoogleCode: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const state = oauthState({ n: 'attacker-nonce', r: 'http://localhost:5174', p: '/classes' });
    const req = { headers: { cookie: 'kt_oauth_state=real-nonce' } } as Request;
    const res = response();

    await controller.googleOAuthCallback('code', state, '', '1.2.3.4', req, res);

    expect(auth.oauthGoogleCode).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalledWith('kt_refresh', expect.anything(), expect.anything());
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:5174/login?oauth_error=state');
  });

  it('callback redirects with denied error when Google returns error / no code', async () => {
    const auth = { oauthGoogleCode: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const state = oauthState({ n: 'n1', r: 'http://localhost:3001', p: '/account' });
    const req = { headers: { cookie: 'kt_oauth_state=n1' } } as Request;
    const res = response();

    await controller.googleOAuthCallback('', state, 'access_denied', '1.2.3.4', req, res);

    expect(auth.oauthGoogleCode).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/login?oauth_error=denied');
  });

  it('callback redirects with failed error when code exchange throws', async () => {
    const auth = {
      oauthGoogleCode: jest.fn().mockRejectedValue(new AppException(ErrorCode.AUTH_REQUIRED, 'x')),
    } as unknown as AuthService;
    const controller = new AuthController(auth, config());
    const state = oauthState({ n: 'n1', r: 'http://localhost:5174', p: '/classes' });
    const req = { headers: { cookie: 'kt_oauth_state=n1' } } as Request;
    const res = response();

    await controller.googleOAuthCallback('bad-code', state, '', '1.2.3.4', req, res);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:5174/login?oauth_error=failed');
  });
});
