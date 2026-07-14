import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from './roles.decorator';

export interface AuthUser {
  userId: string;
  roles: Role[];
  status: string;
  parentProfileId?: string;
  tutorProfileId?: string;
}

// Lấy user đã xác thực từ request (do JwtAuthGuard gắn vào).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser | undefined;
  },
);
