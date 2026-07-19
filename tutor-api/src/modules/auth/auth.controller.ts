import { Body, Controller, Get, HttpCode, Ip, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
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

  @Public()
  // Chống spam đăng ký/gửi email: siết theo IP (13-security). 5 lần / 5 phút.
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
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
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('email/verify')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('email/verify/resend')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
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
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('oauth/facebook')
  async facebookOAuth(
    @Body() dto: FacebookOAuthDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.oauthLogin('facebook', dto.access_token, ip);
    return this.issuePublicSession(response, result);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
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
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
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
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
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
