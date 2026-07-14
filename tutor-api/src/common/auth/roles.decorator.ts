import { SetMetadata } from '@nestjs/common';

export type Role = 'guest' | 'parent' | 'tutor' | 'admin';

// Vai trò lưu trong DB (users.roles). 'guest' chỉ dùng ở tầng route metadata.
export type DbRole = Exclude<Role, 'guest'>;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Đánh dấu endpoint công khai (không cần JWT).
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Xác thực tùy chọn: có token hợp lệ thì gắn user (không ép role/status),
// không có token vẫn cho qua như khách. Dùng cho trang chi tiết công khai
// cần biết trạng thái mở khóa nếu người xem đã đăng nhập.
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

// Escape hatch cho trạng thái user được phép gọi endpoint.
// Mặc định guard chỉ cho `active`; endpoint cần phục vụ user chưa consent
// (vd ghi consent) hoặc chưa chọn vai trò (bootstrap) khai báo ở đây.
export const ALLOW_STATUS_KEY = 'allowStatus';
export type AllowedStatus = 'pending_consent' | 'active';
export const AllowStatus = (...statuses: AllowedStatus[]) =>
  SetMetadata(ALLOW_STATUS_KEY, statuses);
