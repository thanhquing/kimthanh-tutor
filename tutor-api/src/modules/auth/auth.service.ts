import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { newId } from '../../common/utils/id.util';
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from '../../common/utils/hash.util';
import { MailService } from '../mail/mail.service';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

type RefreshRotationResult =
  | { tokens: TokenPair }
  | { code: ErrorCode; error: string };

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
  private dummyAdminPasswordHash: Promise<string> | null = null;
  private dummyUserPasswordHash: Promise<string> | null = null;
  private readonly adminLockThreshold = 5;
  private readonly adminLockDurationMs = 15 * 60_000;
  private readonly userLockThreshold = 10;
  private readonly userLockDurationMs = 15 * 60_000;
  private readonly refreshConcurrencyGraceMs = 5_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async adminPasswordLogin(email: string, password: string, ip?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { adminCredential: true },
    });
    const credential = user?.adminCredential ?? null;
    if (!credential && !this.dummyAdminPasswordHash) this.dummyAdminPasswordHash = hashPassword(randomToken());
    const passwordMatches = await verifyPassword(
      password,
      credential?.passwordHash ?? (await this.dummyAdminPasswordHash!),
    );

    if (credential?.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      throw new AppException(ErrorCode.RATE_LIMITED, 'Đăng nhập tạm khóa, vui lòng thử lại sau');
    }
    if (!user || !credential || !passwordMatches) {
      if (credential) {
        await this.recordAdminLoginFailure(credential.userId);
      }
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Email hoặc mật khẩu không đúng');
    }
    if (user.deletedAt || user.status === 'deleted' || user.status === 'suspended') {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Tài khoản không khả dụng');
    }
    if (!user.roles.includes('admin')) {
      throw new AppException(ErrorCode.FORBIDDEN_ROLE, 'Tài khoản không có quyền admin');
    }

    await this.prisma.adminCredential.update({
      where: { userId: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    const tokens = await this.issueTokens(user.id, ip);
    return {
      ...tokens,
      user: { id: user.id, phone: user.phone, email: user.email, status: user.status },
      consent_required: user.status === 'pending_consent',
    };
  }

  /**
   * Không ghi `failedAttempts = snapshot + 1`: nhiều request song song sẽ làm
   * mất increment. CAS buộc request thua phải đọc lại và cộng trên giá trị mới.
   */
  private async recordAdminLoginFailure(userId: string): Promise<void> {
    for (;;) {
      const current = await this.prisma.adminCredential.findUnique({
        where: { userId },
        select: { failedAttempts: true, lockedUntil: true },
      });
      if (!current) return;
      if (current.lockedUntil && current.lockedUntil.getTime() > Date.now()) return;

      const nextAttempts = current.failedAttempts + 1;
      const updated = await this.prisma.adminCredential.updateMany({
        where: {
          userId,
          failedAttempts: current.failedAttempts,
          lockedUntil: current.lockedUntil,
        },
        data: {
          failedAttempts: nextAttempts,
          lockedUntil:
            nextAttempts >= this.adminLockThreshold
              ? new Date(Date.now() + this.adminLockDurationMs)
              : null,
        },
      });
      if (updated.count === 1) return;
    }
  }

  // ---- Email + password auth (đăng nhập chính hiện tại; OAuth là đích lâu dài) ----

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // Chỉ chấp nhận Gmail hoặc email trường học (domain chứa nhãn `edu`).
  private assertAllowedEmailDomain(email: string): void {
    const domain = email.split('@')[1] ?? '';
    const allowed = domain === 'gmail.com' || /(^|\.)edu(\.|$)/.test(domain);
    if (!allowed) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Chỉ chấp nhận email Gmail hoặc email trường học (.edu).',
      );
    }
  }

  private assertPasswordPolicy(password: string): void {
    const min = this.config.get<number>('password.minLength') ?? 8;
    const max = this.config.get<number>('password.maxLength') ?? 128;
    if (password.length < min || password.length > max) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `Mật khẩu phải từ ${min} đến ${max} ký tự.`,
      );
    }
  }

  private buildEmailLink(kind: 'verify' | 'reset', token: string): string {
    const base = this.config.get<string>('mail.appBaseUrl')!;
    const path = kind === 'verify' ? 'verify-email' : 'reset-password';
    return `${base}/${path}?token=${encodeURIComponent(token)}`;
  }

  // Non-prod trả link trực tiếp để test khi chưa có SMTP thật.
  private devLink(kind: 'verify' | 'reset', token: string): string | undefined {
    if (this.config.get<string>('env') === 'production') return undefined;
    return this.buildEmailLink(kind, token);
  }

  private async createEmailToken(userId: string, type: 'verify' | 'reset'): Promise<string> {
    const token = randomToken();
    const ttl =
      type === 'verify'
        ? this.config.get<number>('mail.verifyTtlSeconds') ?? 86_400
        : this.config.get<number>('mail.resetTtlSeconds') ?? 3_600;
    // Vô hiệu token cùng loại chưa dùng: mỗi lúc chỉ một link còn sống.
    await this.prisma.emailToken.updateMany({
      where: { userId, type, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.emailToken.create({
      data: {
        id: newId(),
        userId,
        type,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    return token;
  }

  // Tiêu thụ token email nguyên tử (chống double-redeem); kiểm loại + hạn.
  private async consumeEmailToken(token: string, type: 'verify' | 'reset') {
    const record = await this.prisma.emailToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.type !== type) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Liên kết không hợp lệ.');
    }
    if (record.consumedAt) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Liên kết đã được sử dụng.');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Liên kết đã hết hạn.');
    }
    const consumed = await this.prisma.emailToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, 'Liên kết đã được sử dụng.');
    }
    return record;
  }

  // POST /auth/register
  async register(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    this.assertAllowedEmailDomain(normalizedEmail);
    this.assertPasswordPolicy(password);

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && !existing.deletedAt) {
      throw new AppException(ErrorCode.CONFLICT, 'Email đã được đăng ký.');
    }

    const passwordHash = await hashPassword(password);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { status: 'pending_verification', emailVerifiedAt: null, deletedAt: null },
        })
      : await this.prisma.user.create({
          data: {
            id: newId(),
            email: normalizedEmail,
            roles: [],
            status: 'pending_verification',
          },
        });
    await this.prisma.userCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash },
      update: { passwordHash, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
    });

    const token = await this.createEmailToken(user.id, 'verify');
    await this.mail.sendVerificationEmail(normalizedEmail, this.buildEmailLink('verify', token));
    const devLink = this.devLink('verify', token);
    return {
      user: { id: user.id, email: user.email, status: user.status },
      verification_required: true,
      ...(devLink ? { dev_verification_link: devLink } : {}),
    };
  }

  // POST /auth/email/verify
  async verifyEmail(token: string) {
    const record = await this.consumeEmailToken(token, 'verify');
    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || user.deletedAt) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tài khoản không tồn tại');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        status: user.status === 'pending_verification' ? 'pending_consent' : user.status,
      },
    });
    return { verified: true };
  }

  // POST /auth/email/verify/resend — luôn 200 (chống dò email tồn tại).
  async resendVerification(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    let devLink: string | undefined;
    if (user && !user.deletedAt && user.status === 'pending_verification') {
      const token = await this.createEmailToken(user.id, 'verify');
      await this.mail.sendVerificationEmail(normalizedEmail, this.buildEmailLink('verify', token));
      devLink = this.devLink('verify', token);
    }
    return { ok: true, ...(devLink ? { dev_verification_link: devLink } : {}) };
  }

  // POST /auth/login
  async login(email: string, password: string, ip?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { userCredential: true },
    });
    const credential = user?.userCredential ?? null;
    if (!credential && !this.dummyUserPasswordHash) {
      this.dummyUserPasswordHash = hashPassword(randomToken());
    }
    const passwordMatches = await verifyPassword(
      password,
      credential?.passwordHash ?? (await this.dummyUserPasswordHash!),
    );

    if (credential?.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      throw new AppException(ErrorCode.RATE_LIMITED, 'Đăng nhập tạm khóa, vui lòng thử lại sau');
    }
    if (!user || !credential || !passwordMatches) {
      if (credential) await this.recordUserLoginFailure(credential.userId);
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Email hoặc mật khẩu không đúng');
    }
    if (user.deletedAt || user.status === 'deleted' || user.status === 'suspended') {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Tài khoản không khả dụng');
    }
    if (!user.emailVerifiedAt || user.status === 'pending_verification') {
      throw new AppException(ErrorCode.EMAIL_NOT_VERIFIED, 'Email chưa được xác thực.');
    }

    await this.prisma.userCredential.update({
      where: { userId: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    const tokens = await this.issueTokens(user.id, ip);
    return {
      ...tokens,
      user: { id: user.id, phone: user.phone, email: user.email, status: user.status },
      consent_required: user.status === 'pending_consent',
    };
  }

  private async recordUserLoginFailure(userId: string): Promise<void> {
    for (;;) {
      const current = await this.prisma.userCredential.findUnique({
        where: { userId },
        select: { failedAttempts: true, lockedUntil: true },
      });
      if (!current) return;
      if (current.lockedUntil && current.lockedUntil.getTime() > Date.now()) return;
      const nextAttempts = current.failedAttempts + 1;
      const updated = await this.prisma.userCredential.updateMany({
        where: { userId, failedAttempts: current.failedAttempts, lockedUntil: current.lockedUntil },
        data: {
          failedAttempts: nextAttempts,
          lockedUntil:
            nextAttempts >= this.userLockThreshold
              ? new Date(Date.now() + this.userLockDurationMs)
              : null,
        },
      });
      if (updated.count === 1) return;
    }
  }

  // POST /auth/password/forgot — luôn 200 (chống account enumeration).
  async forgotPassword(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { userCredential: true },
    });
    let devLink: string | undefined;
    if (user && !user.deletedAt && user.userCredential) {
      const token = await this.createEmailToken(user.id, 'reset');
      await this.mail.sendPasswordResetEmail(normalizedEmail, this.buildEmailLink('reset', token));
      devLink = this.devLink('reset', token);
    }
    return { ok: true, ...(devLink ? { dev_reset_link: devLink } : {}) };
  }

  // POST /auth/password/reset
  async resetPassword(token: string, newPassword: string) {
    this.assertPasswordPolicy(newPassword);
    const record = await this.consumeEmailToken(token, 'reset');
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.userCredential.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, passwordHash },
        update: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        },
      });
      // Đổi mật khẩu là sự kiện thu hồi: hủy mọi refresh token đang sống.
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }

  async oauthLogin(provider: OAuthProvider, token: string, ip?: string) {
    const profile =
      provider === 'google'
        ? await this.verifyGoogleToken(token)
        : await this.verifyFacebookToken(token);
    return this.completeOAuth(profile, ip);
  }

  // Luồng Authorization Code server-side (Google): đổi code lấy id_token bằng
  // client_secret (không rời server), verify rồi register-or-login.
  async oauthGoogleCode(code: string, ip?: string) {
    const idToken = await this.exchangeGoogleCode(code);
    const profile = await this.verifyGoogleToken(idToken);
    return this.completeOAuth(profile, ip);
  }

  // URL redirect người dùng sang Google để cấp quyền (bước /start).
  buildGoogleAuthUrl(state: string): string {
    const clientId = this.config.get<string>('oauth.googleClientId');
    const redirectUri = this.config.get<string>('oauth.googleRedirectUri');
    if (!clientId || !redirectUri) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Chưa cấu hình Google OAuth trên server');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async exchangeGoogleCode(code: string): Promise<string> {
    const clientId = this.config.get<string>('oauth.googleClientId');
    const clientSecret = this.config.get<string>('oauth.googleClientSecret');
    const redirectUri = this.config.get<string>('oauth.googleRedirectUri');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Chưa cấu hình Google OAuth trên server');
    }
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!response.ok) {
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Không đổi được mã Google');
    }
    const data = (await response.json()) as Record<string, unknown>;
    return this.requiredString(data.id_token, 'Google token thiếu id_token');
  }

  private async completeOAuth(profile: VerifiedOAuthProfile, ip?: string) {
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
      auth_provider: profile.provider,
      consent_required: user.status === 'pending_consent',
    };
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
    const prepared = await this.prepareTokenIssue(userId, ip);
    await this.prisma.refreshToken.create({
      data: prepared.refreshRecord,
    });
    return prepared.tokens;
  }

  // POST /auth/refresh — xoay vòng token, phát hiện tái sử dụng (13-security).
  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    return this.rotateRefreshToken(refreshToken, ip, false);
  }

  async refreshAdmin(refreshToken: string, ip?: string): Promise<TokenPair> {
    return this.rotateRefreshToken(refreshToken, ip, true);
  }

  private async rotateRefreshToken(
    refreshToken: string,
    ip: string | undefined,
    requireAdmin: boolean,
  ): Promise<TokenPair> {
    const tokenHash = sha256(refreshToken);
    const result: RefreshRotationResult = await this.prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: { id: true, roles: true, status: true, deletedAt: true },
          },
        },
      });
      if (!record) {
        return {
          code: ErrorCode.AUTH_REQUIRED,
          error: 'Refresh token không hợp lệ',
        } as const;
      }

      // Token đã bị thu hồi mà vẫn được dùng lại: thu hồi cả token-family.
      if (record.revokedAt) {
        // Hai tab có thể gửi cùng cookie gần như đồng thời. Token đã rotate rất
        // gần đây bị từ chối nhưng không được revoke/clear token con của tab thắng.
        if (
          record.rotatedToId &&
          Date.now() - record.revokedAt.getTime() <= this.refreshConcurrencyGraceMs
        ) {
          return {
            code: ErrorCode.CONFLICT,
            error: 'Phiên đang được làm mới ở yêu cầu khác',
          } as const;
        }
        await tx.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return {
          code: ErrorCode.AUTH_REQUIRED,
          error: 'Phiên bị thu hồi, đăng nhập lại',
        } as const;
      }
      if (record.expiresAt.getTime() < Date.now()) {
        await tx.refreshToken.updateMany({
          where: { id: record.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { code: ErrorCode.AUTH_REQUIRED, error: 'Phiên đã hết hạn' } as const;
      }
      if (
        record.user.deletedAt ||
        record.user.status === 'deleted' ||
        record.user.status === 'suspended'
      ) {
        await tx.refreshToken.updateMany({
          where: { id: record.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return {
          code: ErrorCode.AUTH_REQUIRED,
          error: 'Tài khoản không khả dụng',
        } as const;
      }
      if (requireAdmin && !record.user.roles.includes('admin')) {
        await tx.refreshToken.updateMany({
          where: { id: record.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return {
          code: ErrorCode.AUTH_REQUIRED,
          error: 'Phiên admin không hợp lệ',
        } as const;
      }

      // Claim token cũ trước khi tạo token con. Chỉ một request đồng thời thắng.
      const claimedAt = new Date();
      const claimed = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: claimedAt },
      });
      if (claimed.count !== 1) {
        return {
          code: ErrorCode.CONFLICT,
          error: 'Phiên đang được làm mới ở yêu cầu khác',
        } as const;
      }

      const prepared = await this.prepareTokenIssue(record.user.id, ip);
      await tx.refreshToken.create({ data: prepared.refreshRecord });
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { rotatedToId: prepared.refreshRecord.id },
      });
      return { tokens: prepared.tokens } as const;
    });

    if ('tokens' in result) return result.tokens;
    throw new AppException(result.code, result.error);
  }

  private async prepareTokenIssue(userId: string, ip?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<number>('jwt.accessTtl'),
      },
    );
    const refreshToken = randomToken();
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') ?? 1_209_600;
    return {
      tokens: { access_token: accessToken, refresh_token: refreshToken },
      refreshRecord: {
        id: newId(),
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        createdIp: ip ?? null,
      },
    };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
