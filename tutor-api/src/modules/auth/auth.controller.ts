import { Body, Controller, Get, HttpCode, Ip, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  AdminPasswordLoginDto,
  FacebookOAuthDto,
  ForgotPasswordDto,
  GoogleOAuthDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { AllowStatus, Public } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

// Rate limit nhóm auth — cấu hình qua env `AUTH_THROTTLE_*`. Decorator được nạp
// lúc import module nên đọc trực tiếp process.env (main.ts nạp .env sớm bằng
// `dotenv/config`); giá trị mặc định trùng hành vi cũ.
const AUTH_THROTTLE_WINDOW_MS = Number(process.env.AUTH_THROTTLE_WINDOW_SECONDS ?? 300) * 1000;
const RL_STRICT = Number(process.env.AUTH_THROTTLE_LIMIT_STRICT ?? 5);
const RL_MEDIUM = Number(process.env.AUTH_THROTTLE_LIMIT_MEDIUM ?? 10);
const RL_RELAXED = Number(process.env.AUTH_THROTTLE_LIMIT_RELAXED ?? 30);
const rl = (limit: number) => ({ default: { ttl: AUTH_THROTTLE_WINDOW_MS, limit } });

// Hình dạng trả ra cho app công khai. tutor-api không phụ thuộc package
// `contracts` (mỗi bên tự khai type); các interface này phải khớp
// `AuthSessionResponse`/`AuthAccessTokenResponse` trong `packages/contracts`.
interface AuthUserSummary {
  id: string;
  phone: string | null;
  email: string | null;
  status: string;
}
interface AuthSessionResponse {
  access_token: string;
  user: AuthUserSummary;
  consent_required: boolean;
}
interface AuthAccessTokenResponse {
  access_token: string;
}

@Controller('auth')
export class AuthController {
  // App công khai (tutor/parent): refresh token nằm trong cookie HttpOnly này,
  // không trả cho JavaScript (chống XSS đọc trộm) mà vẫn giữ phiên qua reload.
  private readonly publicRefreshCookie = 'kt_refresh';
  // Admin console: cookie riêng, path riêng để cô lập với app công khai.
  private readonly adminRefreshCookie = 'kt_admin_refresh';
  // OAuth code flow: cookie ngắn hạn giữ nonce chống CSRF giữa /start và /callback.
  private readonly oauthStateCookie = 'kt_oauth_state';

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private apiPrefix(): string {
    return (this.config.get<string>('apiPrefix') ?? 'api/v1').replace(/^\/+|\/+$/g, '');
  }

  // Cookie refresh dùng chung khuôn cho public/admin, khác nhau ở `path` để
  // browser chỉ đính cookie đúng nhóm endpoint. Cùng-origin nên `SameSite=Strict`
  // đủ chống CSRF, không cần double-submit token.
  private refreshCookieOptions(path: string): CookieOptions {
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') ?? 1_209_600;
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('env') === 'production',
      path,
      maxAge: refreshTtl * 1000,
    };
  }

  private publicCookieOptions(): CookieOptions {
    return this.refreshCookieOptions(`/${this.apiPrefix()}/auth`);
  }

  private adminCookieOptions(): CookieOptions {
    return this.refreshCookieOptions(`/${this.apiPrefix()}/auth/admin`);
  }

  private readRefreshCookie(request: Request, name: string): string | null {
    const header = request.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
      const [rawName, ...rawValue] = part.trim().split('=');
      if (rawName === name) {
        try {
          return decodeURIComponent(rawValue.join('='));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private clearRefreshCookie(response: Response, name: string, options: CookieOptions): void {
    const clearOptions = { ...options };
    delete clearOptions.maxAge;
    response.clearCookie(name, clearOptions);
  }

  // Đặt refresh token vào cookie HttpOnly và chỉ trả access token + thông tin
  // phiên cho JavaScript. Refresh token KHÔNG bao giờ rời server qua body.
  private issuePublicSession(
    response: Response,
    result: { access_token: string; refresh_token: string; user: AuthUserSummary; consent_required: boolean },
  ): AuthSessionResponse {
    response.cookie(this.publicRefreshCookie, result.refresh_token, this.publicCookieOptions());
    return {
      access_token: result.access_token,
      user: result.user,
      consent_required: result.consent_required,
    };
  }

  private oauthStateCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Lax (không Strict): cookie phải được gửi khi Google redirect top-level về callback.
      sameSite: 'lax',
      secure: this.config.get<string>('env') === 'production',
      path: `/${this.apiPrefix()}/auth/oauth/google`,
      maxAge: this.config.get<number>('oauth.stateTtlMs') ?? 600_000,
    };
  }

  // Chỉ cho redirect về origin trong allowlist (chống open-redirect); sai → base đầu tiên.
  private resolveReturnBase(returnTo: string | undefined): string {
    const allow = this.config.get<string[]>('oauth.returnUrls') ?? [];
    const fallback = allow[0] ?? '';
    if (!returnTo) return fallback;
    const normalized = returnTo.replace(/\/$/, '');
    return allow.includes(normalized) ? normalized : fallback;
  }

  // Chỉ nhận path nội bộ mở đầu bằng đúng một "/" (chống open-redirect qua next).
  private safeNextPath(next: string | undefined): string {
    if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
  }

  @Public()
  // Chống spam đăng ký/gửi email: siết theo IP (13-security). 5 lần / 5 phút.
  @Throttle(rl(RL_STRICT))
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Public()
  @Throttle(rl(RL_MEDIUM))
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, ip);
    return this.issuePublicSession(response, result);
  }

  @Public()
  @Throttle(rl(RL_RELAXED))
  @Post('email/verify')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Throttle(rl(RL_STRICT))
  @Post('email/verify/resend')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Throttle(rl(RL_STRICT))
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(rl(RL_MEDIUM))
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Throttle(rl(RL_RELAXED))
  @Post('oauth/google')
  async googleOAuth(
    @Body() dto: GoogleOAuthDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.oauthLogin('google', dto.id_token, ip);
    return this.issuePublicSession(response, result);
  }

  @Public()
  @Throttle(rl(RL_RELAXED))
  @Post('oauth/facebook')
  async facebookOAuth(
    @Body() dto: FacebookOAuthDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.oauthLogin('facebook', dto.access_token, ip);
    return this.issuePublicSession(response, result);
  }

  // Bước 1 luồng code server-side: đặt nonce chống CSRF vào cookie rồi redirect
  // người dùng sang Google. `return_to`/`next` được nhúng vào state (base64).
  @Public()
  @Throttle(rl(RL_RELAXED))
  @Get('oauth/google/start')
  googleOAuthStart(
    @Query('return_to') returnTo: string,
    @Query('next') next: string,
    @Res() response: Response,
  ) {
    const nonce = randomUUID();
    const base = this.resolveReturnBase(returnTo);
    const path = this.safeNextPath(next);
    const state = Buffer.from(JSON.stringify({ n: nonce, r: base, p: path })).toString('base64url');
    response.cookie(this.oauthStateCookie, nonce, this.oauthStateCookieOptions());
    response.redirect(this.auth.buildGoogleAuthUrl(state));
  }

  // Bước 2: Google redirect về đây kèm code. Verify CSRF (nonce), đổi code lấy
  // id_token (client_secret ở server), set cookie phiên rồi redirect về FE.
  @Public()
  @Throttle(rl(RL_RELAXED))
  @Get('oauth/google/callback')
  async googleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Ip() ip: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const cookieNonce = this.readRefreshCookie(request, this.oauthStateCookie);
    this.clearRefreshCookie(response, this.oauthStateCookie, this.oauthStateCookieOptions());

    let parsed: { n?: string; r?: string; p?: string } = {};
    try {
      parsed = JSON.parse(Buffer.from(state ?? '', 'base64url').toString('utf8')) as typeof parsed;
    } catch {
      // state hỏng → xử lý như CSRF fail bên dưới
    }
    const base = this.resolveReturnBase(parsed.r);
    const path = this.safeNextPath(parsed.p);

    // CSRF: state trong URL phải khớp nonce trong cookie của chính browser này.
    if (!cookieNonce || !parsed.n || parsed.n !== cookieNonce) {
      return response.redirect(`${base}/login?oauth_error=state`);
    }
    if (error || !code) {
      return response.redirect(`${base}/login?oauth_error=denied`);
    }
    try {
      const result = await this.auth.oauthGoogleCode(code, ip);
      response.cookie(this.publicRefreshCookie, result.refresh_token, this.publicCookieOptions());
      return response.redirect(`${base}${path}`);
    } catch {
      return response.redirect(`${base}/login?oauth_error=failed`);
    }
  }

  @Public()
  @Throttle(rl(RL_STRICT))
  @Post('admin/password')
  async adminPassword(
    @Body() dto: AdminPasswordLoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.adminPasswordLogin(dto.email, dto.password, ip);
    response.cookie(this.adminRefreshCookie, result.refresh_token, this.adminCookieOptions());
    return {
      access_token: result.access_token,
      user: result.user,
      consent_required: result.consent_required,
    };
  }

  @Public()
  @Throttle(rl(RL_RELAXED))
  @Post('admin/refresh')
  async adminRefresh(
    @Req() request: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.readRefreshCookie(request, this.adminRefreshCookie);
    try {
      const tokens = await this.auth.refreshAdmin(refreshToken ?? '', ip);
      response.cookie(this.adminRefreshCookie, tokens.refresh_token, this.adminCookieOptions());
      return { access_token: tokens.access_token };
    } catch (error) {
      // Chỉ xóa cookie khi phiên thật sự không hợp lệ. Lỗi 5xx tạm thời không
      // được phá một refresh token vẫn còn dùng được.
      if (error instanceof AppException && error.code === ErrorCode.AUTH_REQUIRED) {
        this.clearRefreshCookie(response, this.adminRefreshCookie, this.adminCookieOptions());
      }
      throw error;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('admin/logout')
  async adminLogout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.readRefreshCookie(request, this.adminRefreshCookie);
    this.clearRefreshCookie(response, this.adminRefreshCookie, this.adminCookieOptions());
    if (refreshToken) await this.auth.revokeRefreshToken(refreshToken);
  }

  @Public()
  @Throttle(rl(RL_RELAXED))
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthAccessTokenResponse> {
    const refreshToken = this.readRefreshCookie(request, this.publicRefreshCookie);
    try {
      const tokens = await this.auth.refresh(refreshToken ?? '', ip);
      response.cookie(this.publicRefreshCookie, tokens.refresh_token, this.publicCookieOptions());
      return { access_token: tokens.access_token };
    } catch (error) {
      // Chỉ xóa cookie khi phiên thật sự không hợp lệ (AUTH_REQUIRED). Lỗi tạm
      // thời (5xx) hay tranh chấp rotate (CONFLICT) không được phá cookie còn dùng.
      if (error instanceof AppException && error.code === ErrorCode.AUTH_REQUIRED) {
        this.clearRefreshCookie(response, this.publicRefreshCookie, this.publicCookieOptions());
      }
      throw error;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.readRefreshCookie(request, this.publicRefreshCookie);
    this.clearRefreshCookie(response, this.publicRefreshCookie, this.publicCookieOptions());
    if (refreshToken) await this.auth.revokeRefreshToken(refreshToken);
  }

  // Cho phép cả user chưa consent để client biết trạng thái sau verify.
  @AllowStatus('pending_consent', 'active')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
