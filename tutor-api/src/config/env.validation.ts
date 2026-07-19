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
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .default('http://localhost:3000/api/v1/auth/oauth/google/callback'),
  GOOGLE_OAUTH_SCOPE: z.string().default('openid email profile'),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  // Allowlist origin FE được redirect về sau callback (chống open-redirect).
  OAUTH_RETURN_URLS: z.string().default('http://localhost:5174,http://localhost:3001'),
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),

  // Chính sách xác thực (whitelist email + khóa tài khoản + grace rotate).
  AUTH_ALLOWED_EMAIL_DOMAINS: z.string().default('gmail.com'),
  AUTH_ALLOW_EDU_EMAILS: z.enum(['true', 'false']).default('true'),
  AUTH_ADMIN_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
  AUTH_ADMIN_LOCK_DURATION_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_USER_LOCK_THRESHOLD: z.coerce.number().int().positive().default(10),
  AUTH_USER_LOCK_DURATION_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_CONCURRENCY_GRACE_MS: z.coerce.number().int().nonnegative().default(5000),

  // Rate limit (global + nhóm auth). Window tính bằng giây.
  GLOBAL_THROTTLE_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  GLOBAL_THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  AUTH_THROTTLE_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  AUTH_THROTTLE_LIMIT_STRICT: z.coerce.number().int().positive().default(5),
  AUTH_THROTTLE_LIMIT_MEDIUM: z.coerce.number().int().positive().default(10),
  AUTH_THROTTLE_LIMIT_RELAXED: z.coerce.number().int().positive().default(30),

  PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().default(8),
  PASSWORD_MAX_LENGTH: z.coerce.number().int().positive().default(128),

  // Email giao dịch (Resend). Ở production bắt buộc có API key + from; dev/test
  // thiếu key → fallback trả link trực tiếp (dev) để test.
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('Kim Thành Tutor <no-reply@kimthanh.tutor>'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  MAIL_VERIFY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  MAIL_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),

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
    if (!env.GOOGLE_CLIENT_ID.trim() || !env.GOOGLE_CLIENT_SECRET.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message:
          'GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET bắt buộc ở production cho luồng OAuth code server-side',
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
