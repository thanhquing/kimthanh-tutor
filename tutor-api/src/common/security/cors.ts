import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// Chỉ cho phép localhost khi dev/test. Không reflect mọi Origin (kèm credentials
// = rủi ro), kể cả ở non-production. Xem ai-tasks/15 mục A05/API8.
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Quy tắc origin CORS: production bắt buộc allowlist tường minh (env validation
// đã ép `CORS_ORIGINS`); non-production chỉ mở cho localhost; nếu không có
// allowlist ở production thì fail closed (deny) thay vì reflect.
export function resolveCorsOrigin(
  env: string | undefined,
  configuredOrigins: string[],
): CorsOptions['origin'] {
  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }
  if (env !== 'production') {
    return LOCALHOST_ORIGIN;
  }
  return false;
}
