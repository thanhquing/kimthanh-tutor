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
  GoogleOAuthDto,
  RefreshDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AllowStatus, Public } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('auth')
export class AuthController {
  private readonly adminRefreshCookie = 'kt_admin_refresh';

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private adminCookieOptions(): CookieOptions {
    const prefix = (this.config.get<string>('apiPrefix') ?? 'api/v1').replace(/^\/+|\/+$/g, '');
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') ?? 1_209_600;
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('env') === 'production',
      path: `/${prefix}/auth/admin`,
      maxAge: refreshTtl * 1000,
    };
  }

  private readAdminRefreshCookie(request: Request): string | null {
    const header = request.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
      const [rawName, ...rawValue] = part.trim().split('=');
      if (rawName === this.adminRefreshCookie) {
        try {
          return decodeURIComponent(rawValue.join('='));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private clearAdminRefreshCookie(response: Response): void {
    const options = this.adminCookieOptions();
    delete options.maxAge;
    response.clearCookie(this.adminRefreshCookie, options);
  }

  @Public()
  // Chống SMS-pumping/spam OTP: siết theo IP (13-security). 5 lần / 5 phút.
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto.channel, dto.destination, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto, @Ip() ip: string) {
    return this.auth.verifyOtp(dto.request_id, dto.code, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('oauth/google')
  googleOAuth(@Body() dto: GoogleOAuthDto, @Ip() ip: string) {
    return this.auth.oauthLogin('google', dto.id_token, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('oauth/facebook')
  facebookOAuth(@Body() dto: FacebookOAuthDto, @Ip() ip: string) {
    return this.auth.oauthLogin('facebook', dto.access_token, ip);
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
    const refreshToken = this.readAdminRefreshCookie(request);
    try {
      const tokens = await this.auth.refreshAdmin(refreshToken ?? '', ip);
      response.cookie(this.adminRefreshCookie, tokens.refresh_token, this.adminCookieOptions());
      return { access_token: tokens.access_token };
    } catch (error) {
      // Chỉ xóa cookie khi phiên thật sự không hợp lệ. Lỗi 5xx tạm thời không
      // được phá một refresh token vẫn còn dùng được.
      if (error instanceof AppException && error.code === ErrorCode.AUTH_REQUIRED) {
        this.clearAdminRefreshCookie(response);
      }
      throw error;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('admin/logout')
  async adminLogout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.readAdminRefreshCookie(request);
    this.clearAdminRefreshCookie(response);
    if (refreshToken) await this.auth.revokeRefreshToken(refreshToken);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Ip() ip: string) {
    return this.auth.refresh(dto.refresh_token, ip);
  }

  // Cho phép cả user chưa consent để client biết trạng thái sau verify.
  @AllowStatus('pending_consent', 'active')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
