import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { newId } from '../../common/utils/id.util';
import {
  generateOtpCode,
  hashOtp,
  randomToken,
  safeEqualHex,
  sha256,
} from '../../common/utils/hash.util';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

type OAuthProvider = 'google' | 'facebook';

interface VerifiedOAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // POST /auth/otp/request — tạo OTP, lưu hash (13-security: không plaintext).
  async requestOtp(channel: 'sms' | 'email', destination: string, ip?: string) {
    const ttl = this.config.get<number>('otp.ttlSeconds') ?? 300;
    const id = newId();
    const code =
      this.config.get<string>('env') === 'production' ? generateOtpCode() : '272727';
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const normalized = destination.trim().toLowerCase();

    await this.prisma.otpRequest.create({
      data: {
        id,
        channel,
        destination: normalized,
        codeHash: hashOtp(code, id),
        expiresAt,
        requestIp: ip ?? null,
      },
    });

    // TODO(worker): gửi OTP qua provider SMS/email. Dev: log để test.
    if (this.config.get<string>('env') !== 'production') {
      this.logger.warn(`[DEV] OTP ${channel} cho ${normalized} = ${code}`);
    }

    return {
      request_id: id,
      expires_at: expiresAt.toISOString(),
      ...(this.config.get<string>('env') !== 'production'
        ? { dev_code: code }
        : {}),
    };
  }

  // POST /auth/otp/verify — kiểm tra OTP, tạo/lấy user, cấp token.
  async verifyOtp(requestId: string, code: string, ip?: string) {
    const otp = await this.prisma.otpRequest.findUnique({
      where: { id: requestId },
    });
    if (!otp) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'OTP không tồn tại');
    }
    if (otp.consumedAt) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'OTP đã dùng');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'OTP đã hết hạn');
    }
    const maxAttempts = this.config.get<number>('otp.maxAttempts') ?? 5;
    if (otp.attempts >= maxAttempts) {
      throw new AppException(ErrorCode.RATE_LIMITED, 'Nhập sai quá số lần');
    }

    const ok = safeEqualHex(otp.codeHash, hashOtp(code, otp.id));
    if (!ok) {
      await this.prisma.otpRequest.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'OTP sai');
    }

    // Tiêu thụ OTP nguyên tử: chỉ 1 request thắng (chống double-redeem race).
    const consumed = await this.prisma.otpRequest.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'OTP đã dùng');
    }

    const user = await this.resolveUser(otp.channel, otp.destination);

    const tokens = await this.issueTokens(user.id, ip);
    return {
      ...tokens,
      user: { id: user.id, phone: user.phone, email: user.email, status: user.status },
      consent_required: user.status === 'pending_consent',
    };
  }

  async oauthLogin(provider: OAuthProvider, token: string, ip?: string) {
    const profile =
      provider === 'google'
        ? await this.verifyGoogleToken(token)
        : await this.verifyFacebookToken(token);

    const user = await this.resolveOAuthUser(profile);
    const tokens = await this.issueTokens(user.id, ip);
    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        status: user.status,
      },
      auth_provider: provider,
      consent_required: user.status === 'pending_consent',
    };
  }

  // Định danh user theo kênh OTP fallback. SMS = tạo/đăng nhập bằng SĐT;
  // email chỉ đăng nhập tài khoản đã liên kết email. Chặn user đã xóa.
  private async resolveUser(channel: string, destination: string) {
    if (channel === 'email') {
      const existing = await this.prisma.user.findUnique({
        where: { email: destination },
      });
      if (!existing) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          'Email chưa liên kết tài khoản. Vui lòng đăng ký bằng SĐT (SMS).',
        );
      }
      if (existing.deletedAt) {
        throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Tài khoản đã bị xóa');
      }
      return existing;
    }

    // channel === 'sms'
    const existing = await this.prisma.user.findUnique({
      where: { phone: destination },
    });
    if (existing) {
      if (existing.deletedAt) {
        throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Tài khoản đã bị xóa');
      }
      return existing;
    }
    return this.prisma.user.create({
      data: {
        id: newId(),
        phone: destination,
        roles: [],
        status: 'pending_consent',
      },
    });
  }

  private async resolveOAuthUser(profile: VerifiedOAuthProfile) {
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
          },
        },
        include: { user: true },
      });
      if (linked) {
        if (linked.user.deletedAt) {
          throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Tài khoản đã bị xóa');
        }
        const shouldUpdateEmail =
          profile.emailVerified && profile.email && !linked.user.email;
        const emailOwner = shouldUpdateEmail
          ? await tx.user.findUnique({ where: { email: profile.email! } })
          : null;
        const user = shouldUpdateEmail && !emailOwner
          ? await tx.user.update({
              where: { id: linked.user.id },
              data: { email: profile.email },
            })
          : linked.user;
        await tx.authAccount.update({
          where: { id: linked.id },
          data: {
            email: profile.email,
            emailVerified: profile.emailVerified,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          },
        });
        return user;
      }

      const existingByEmail =
        profile.emailVerified && profile.email
          ? await tx.user.findUnique({ where: { email: profile.email } })
          : null;
      if (existingByEmail?.deletedAt) {
        throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Tài khoản đã bị xóa');
      }

      const user =
        existingByEmail ??
        (await tx.user.create({
          data: {
            id: newId(),
            phone: null,
            email: profile.emailVerified ? profile.email : null,
            roles: [],
            status: 'pending_consent',
          },
        }));

      await tx.authAccount.create({
        data: {
          id: newId(),
          userId: user.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
      });
      return user;
    });
  }

  private async verifyGoogleToken(token: string): Promise<VerifiedOAuthProfile> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
    );
    if (!response.ok) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Google token không hợp lệ');
    }
    const data = (await response.json()) as Record<string, unknown>;
    const sub = this.requiredString(data.sub, 'Google token thiếu subject');
    const aud = this.requiredString(data.aud, 'Google token thiếu audience');
    const expectedAud = this.config.get<string>('oauth.googleClientId');
    if (expectedAud && aud !== expectedAud) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Google token sai client');
    }
    const email = this.optionalString(data.email)?.toLowerCase() ?? null;
    const emailVerified =
      data.email_verified === true || data.email_verified === 'true';
    if (!email || !emailVerified) {
      throw new AppException(
        ErrorCode.AUTH_REQUIRED,
        'Google token cần email đã xác minh',
      );
    }
    return {
      provider: 'google',
      providerUserId: sub,
      email,
      emailVerified,
      displayName: this.optionalString(data.name),
      avatarUrl: this.optionalString(data.picture),
    };
  }

  private async verifyFacebookToken(token: string): Promise<VerifiedOAuthProfile> {
    const appId = this.config.get<string>('oauth.facebookAppId');
    const appSecret = this.config.get<string>('oauth.facebookAppSecret');
    if (!appId || !appSecret) {
      throw new AppException(
        ErrorCode.AUTH_REQUIRED,
        'Chưa cấu hình Facebook OAuth trên server',
      );
    }

    const appAccessToken = `${appId}|${appSecret}`;
    const debugUrl =
      'https://graph.facebook.com/debug_token?' +
      new URLSearchParams({
        input_token: token,
        access_token: appAccessToken,
      }).toString();
    const debugResponse = await fetch(debugUrl);
    if (!debugResponse.ok) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Facebook token không hợp lệ');
    }
    const debug = (await debugResponse.json()) as {
      data?: { is_valid?: boolean; app_id?: string; user_id?: string };
    };
    if (!debug.data?.is_valid || debug.data.app_id !== appId || !debug.data.user_id) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Facebook token không hợp lệ');
    }

    const meUrl =
      'https://graph.facebook.com/me?' +
      new URLSearchParams({
        fields: 'id,name,email,picture',
        access_token: token,
      }).toString();
    const meResponse = await fetch(meUrl);
    if (!meResponse.ok) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Không đọc được Facebook profile');
    }
    const me = (await meResponse.json()) as Record<string, unknown>;
    const id = this.requiredString(me.id, 'Facebook profile thiếu id');
    if (id !== debug.data.user_id) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Facebook token sai user');
    }
    const email = this.optionalString(me.email)?.toLowerCase() ?? null;
    const picture =
      typeof me.picture === 'object' && me.picture !== null
        ? this.optionalString(
            ((me.picture as Record<string, unknown>).data as Record<string, unknown>)
              ?.url,
          )
        : null;

    return {
      provider: 'facebook',
      providerUserId: id,
      email,
      // Facebook chỉ trả email khi user/account đã xác nhận và app được cấp scope email.
      emailVerified: email !== null,
      displayName: this.optionalString(me.name),
      avatarUrl: picture,
    };
  }

  private requiredString(value: unknown, message: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, message);
    }
    return value.trim();
  }

  private optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  // Access token JWT chỉ mang `sub` (userId) + typ. Roles/status guard đọc từ DB.
  // Refresh token: chuỗi ngẫu nhiên, lưu HASH trong bảng refresh_tokens (thu hồi được).
  async issueTokens(userId: string, ip?: string): Promise<TokenPair> {
    const access = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<number>('jwt.accessTtl'),
      },
    );

    const refreshRaw = randomToken();
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') ?? 1_209_600;
    await this.prisma.refreshToken.create({
      data: {
        id: newId(),
        userId,
        tokenHash: sha256(refreshRaw),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        createdIp: ip ?? null,
      },
    });

    return { access_token: access, refresh_token: refreshRaw };
  }

  // POST /auth/refresh — xoay vòng token, phát hiện tái sử dụng (13-security).
  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    const hash = sha256(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!record) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Refresh token không hợp lệ');
    }

    // Token đã bị thu hồi mà vẫn được dùng lại → nghi bị đánh cắp: thu hồi toàn bộ.
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppException(
        ErrorCode.AUTH_REQUIRED,
        'Phiên bị thu hồi, đăng nhập lại',
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Phiên đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });
    if (!user || user.deletedAt || user.status === 'suspended') {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Tài khoản không khả dụng');
    }

    const next = await this.issueTokens(user.id, ip);
    const nextHash = sha256(next.refresh_token);
    const nextRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: nextHash },
      select: { id: true },
    });
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), rotatedToId: nextRecord?.id ?? null },
    });
    return next;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        parentProfile: { select: { id: true } },
        tutorProfile: { select: { id: true } },
      },
    });
    if (!user) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'User không tồn tại');
    }
    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        status: user.status,
      },
      roles: user.roles,
      profiles: {
        parent: user.parentProfile ? { id: user.parentProfile.id } : null,
        tutor: user.tutorProfile ? { id: user.tutorProfile.id } : null,
      },
    };
  }
}
