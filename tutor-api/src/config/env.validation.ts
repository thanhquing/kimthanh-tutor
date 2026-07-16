import { z } from 'zod';

// Validate biến môi trường lúc khởi động (fail fast — 13-security).
// Ở production BẮT BUỘC có secret thật; không cho phép giá trị mặc định dev.
// Ở dev/test cho phép thiếu (dùng default) nhưng vẫn kiểm định dạng.

const INSECURE_SECRETS = new Set([
  'dev-access',
  'dev-refresh',
  'change-me',
  'change-me-access',
  'change-me-refresh',
]);

const base = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z.string().default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL bắt buộc'),

  JWT_ACCESS_SECRET: z.string().default('dev-access'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1_209_600),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  GOOGLE_CLIENT_ID: z.string().default(''),
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),

  CONSENT_STORE_IP: z.enum(['true', 'false']).default('true'),
  CONSENT_STORE_USER_AGENT: z.enum(['true', 'false']).default('true'),

  PLATFORM_BANK_CODE: z.string().default(''),
  PLATFORM_BANK_ACCOUNT: z.string().default(''),
  PLATFORM_BANK_ACCOUNT_NAME: z.string().default(''),
  SEPAY_WEBHOOK_API_KEY: z.string().default(''),
  SEPAY_IP_ALLOWLIST: z.string().default(''),

  STORAGE_ENDPOINT: z.string().default(''),
  STORAGE_BUCKET: z.string().default(''),
  STORAGE_ACCESS_KEY: z.string().default(''),
  STORAGE_SECRET_KEY: z.string().default(''),
  // Bí mật ký signed URL cho media (HMAC). Bắt buộc ở production.
  MEDIA_SIGNING_SECRET: z.string().default('dev-media-signing'),
};

const schema = z
  .object(base)
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    // Production: từ chối secret mặc định/không an toàn (fail closed).
    const requireStrong = (
      key: keyof typeof env,
      minLen = 16,
    ): void => {
      const val = String(env[key] ?? '');
      if (!val || INSECURE_SECRETS.has(val) || val.length < minLen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} phải là secret mạnh (≥${minLen} ký tự) ở production, không được dùng giá trị mặc định`,
        });
      }
    };

    requireStrong('JWT_ACCESS_SECRET');
    requireStrong('JWT_REFRESH_SECRET');
    requireStrong('MEDIA_SIGNING_SECRET');
    requireStrong('SEPAY_WEBHOOK_API_KEY', 8);
    if (!env.CORS_ORIGINS.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS bắt buộc ở production',
      });
    }
    if (!env.GOOGLE_CLIENT_ID.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message: 'GOOGLE_CLIENT_ID bắt buộc ở production để verify Google ID token',
      });
    }
    if (!env.FACEBOOK_APP_ID.trim() || !env.FACEBOOK_APP_SECRET.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FACEBOOK_APP_ID'],
        message: 'FACEBOOK_APP_ID và FACEBOOK_APP_SECRET bắt buộc ở production để verify Facebook access token',
      });
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET phải khác JWT_ACCESS_SECRET',
      });
    }

    // Webhook thanh toán cần allowlist IP để không tin payload tùy tiện.
    if (!env.SEPAY_IP_ALLOWLIST.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SEPAY_IP_ALLOWLIST'],
        message: 'SEPAY_IP_ALLOWLIST bắt buộc ở production (verify nguồn webhook)',
      });
    }
  });

export type ValidatedEnv = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): ValidatedEnv {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${details}`);
  }
  return parsed.data;
}
