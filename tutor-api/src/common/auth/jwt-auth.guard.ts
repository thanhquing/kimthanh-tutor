import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import {
  ALLOW_STATUS_KEY,
  AllowedStatus,
  IS_OPTIONAL_AUTH_KEY,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  Role,
} from './roles.decorator';
import { AuthUser } from './auth-user';

// Xác thực JWT + kiểm tra vai trò + trạng thái. Fail closed (13-security).
//
// Quyết định kiến trúc: guard đọc roles/status/profileIds TRỰC TIẾP từ DB theo
// mỗi request (JWT chỉ mang `sub` = userId). Nhờ vậy:
//  - Không có claim "chết cứng" lỗi thời (đổi vai trò, consent, admin suspend
//    có hiệu lực ngay, không đợi token hết hạn).
//  - Thu hồi được (suspended/deleted bị chặn tức thì).
//  - Không cần phát token lại sau khi bootstrap vai trò.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) {
      if (isOptional) return true; // khách chưa đăng nhập
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Cần đăng nhập');
    }

    let sub: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ?: string }>(
        token,
        { secret: this.config.get<string>('jwt.accessSecret') },
      );
      if (payload.typ && payload.typ !== 'access') {
        throw new Error('sai loại token');
      }
      sub = payload.sub;
    } catch {
      if (isOptional) return true; // token hỏng → coi như khách
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Token không hợp lệ');
    }

    // Nguồn sự thật là DB, không phải claim trong token.
    const user = await this.prisma.user.findFirst({
      where: { id: sub },
      select: {
        id: true,
        roles: true,
        status: true,
        deletedAt: true,
        parentProfile: { select: { id: true } },
        tutorProfile: { select: { id: true } },
      },
    });
    if (!user || user.deletedAt) {
      if (isOptional) return true;
      throw new AppException(ErrorCode.AUTH_REQUIRED, 'Phiên không hợp lệ');
    }

    const authUser: AuthUser = {
      userId: user.id,
      roles: user.roles as Role[],
      status: user.status,
      parentProfileId: user.parentProfile?.id,
      tutorProfileId: user.tutorProfile?.id,
    };
    (req as Request & { user?: AuthUser }).user = authUser;

    // Optional auth: đã gắn user, không ép role/status (khách xem có điều kiện).
    if (isOptional) return true;

    // Kiểm tra trạng thái tài khoản (fail closed). Mặc định chỉ `active`.
    const allowedStatuses =
      this.reflector.getAllAndOverride<AllowedStatus[]>(ALLOW_STATUS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? (['active'] as AllowedStatus[]);

    if (!allowedStatuses.includes(user.status as AllowedStatus)) {
      if (user.status === 'pending_consent') {
        throw new AppException(
          ErrorCode.CONSENT_REQUIRED,
          'Cần đồng ý điều khoản trước khi tiếp tục',
        );
      }
      throw new AppException(
        ErrorCode.FORBIDDEN_ROLE,
        `Tài khoản đang ở trạng thái ${user.status}, không thể thực hiện`,
      );
    }

    // Kiểm tra vai trò (RBAC thô; ownership kiểm ở service).
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const has = requiredRoles.some((r) => authUser.roles.includes(r));
      if (!has) {
        throw new AppException(
          ErrorCode.FORBIDDEN_ROLE,
          'Không đủ quyền cho hành động này',
        );
      }
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [type, value] = header.split(' ');
    return type === 'Bearer' && value ? value : null;
  }
}
