export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  otp: {
    ttlSeconds: number;
    maxAttempts: number;
  };
  oauth: {
    googleClientId: string;
    googleClientSecret: string;
    // redirect_uri đăng ký ở Google Console; server nhận code tại đây.
    googleRedirectUri: string;
    // Scope xin từ Google (cách nhau khoảng trắng).
    googleScope: string;
    // TTL cookie state chống CSRF giữa /start và /callback (ms).
    stateTtlMs: number;
    // Allowlist origin FE được phép redirect về sau callback (chống open-redirect).
    returnUrls: string[];
    facebookAppId: string;
    facebookAppSecret: string;
  };
  // Chính sách xác thực: whitelist email + khóa tài khoản + grace rotate refresh.
  auth: {
    allowedEmailDomains: string[];
    allowEduEmails: boolean;
    adminLockThreshold: number;
    adminLockDurationMs: number;
    userLockThreshold: number;
    userLockDurationMs: number;
    refreshConcurrencyGraceMs: number;
  };
  // Rate limit: global + nhóm auth nhạy cảm (đơn vị window = ms).
  throttle: {
    globalWindowMs: number;
    globalLimit: number;
    authWindowMs: number;
    authStrict: number;
    authMedium: number;
    authRelaxed: number;
  };
  password: {
    minLength: number;
    maxLength: number;
  };
  mail: {
    resendApiKey: string;
    from: string;
    appBaseUrl: string;
    verifyTtlSeconds: number;
    resetTtlSeconds: number;
  };
  consent: {
    storeIp: boolean;
    storeUserAgent: boolean;
  };
  payment: {
    platformBankCode: string;
    platformBankAccount: string;
    platformBankAccountName: string;
    sepayWebhookApiKey: string;
    sepayIpAllowlist: string[];
  };
  media: {
    signingSecret: string;
    storageEndpoint: string;
    storageBucket: string;
  };
}

// Đọc từ process.env đã được validateEnv() kiểm định (env.validation.ts).
export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
  },
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ??
      'http://localhost:3000/api/v1/auth/oauth/google/callback',
    googleScope: process.env.GOOGLE_OAUTH_SCOPE ?? 'openid email profile',
    stateTtlMs: parseInt(process.env.OAUTH_STATE_TTL_SECONDS ?? '600', 10) * 1000,
    returnUrls: (process.env.OAUTH_RETURN_URLS ?? 'http://localhost:5174,http://localhost:3001')
      .split(',')
      .map((url) => url.trim().replace(/\/$/, ''))
      .filter(Boolean),
    facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
    facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? '',
  },
  auth: {
    allowedEmailDomains: (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? 'gmail.com')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    allowEduEmails: (process.env.AUTH_ALLOW_EDU_EMAILS ?? 'true') === 'true',
    adminLockThreshold: parseInt(process.env.AUTH_ADMIN_LOCK_THRESHOLD ?? '5', 10),
    adminLockDurationMs: parseInt(process.env.AUTH_ADMIN_LOCK_DURATION_SECONDS ?? '900', 10) * 1000,
    userLockThreshold: parseInt(process.env.AUTH_USER_LOCK_THRESHOLD ?? '10', 10),
    userLockDurationMs: parseInt(process.env.AUTH_USER_LOCK_DURATION_SECONDS ?? '900', 10) * 1000,
    refreshConcurrencyGraceMs: parseInt(process.env.AUTH_REFRESH_CONCURRENCY_GRACE_MS ?? '5000', 10),
  },
  throttle: {
    globalWindowMs: parseInt(process.env.GLOBAL_THROTTLE_WINDOW_SECONDS ?? '60', 10) * 1000,
    globalLimit: parseInt(process.env.GLOBAL_THROTTLE_LIMIT ?? '120', 10),
    authWindowMs: parseInt(process.env.AUTH_THROTTLE_WINDOW_SECONDS ?? '300', 10) * 1000,
    authStrict: parseInt(process.env.AUTH_THROTTLE_LIMIT_STRICT ?? '5', 10),
    authMedium: parseInt(process.env.AUTH_THROTTLE_LIMIT_MEDIUM ?? '10', 10),
    authRelaxed: parseInt(process.env.AUTH_THROTTLE_LIMIT_RELAXED ?? '30', 10),
  },
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH ?? '8', 10),
    maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH ?? '128', 10),
  },
  mail: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.MAIL_FROM ?? 'Kim Thành Tutor <no-reply@kimthanh.tutor>',
    appBaseUrl: (process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    verifyTtlSeconds: parseInt(process.env.MAIL_VERIFY_TTL_SECONDS ?? '86400', 10),
    resetTtlSeconds: parseInt(process.env.MAIL_RESET_TTL_SECONDS ?? '3600', 10),
  },
  consent: {
    storeIp: (process.env.CONSENT_STORE_IP ?? 'true') === 'true',
    storeUserAgent: (process.env.CONSENT_STORE_USER_AGENT ?? 'true') === 'true',
  },
  payment: {
    platformBankCode: process.env.PLATFORM_BANK_CODE ?? '',
    platformBankAccount: process.env.PLATFORM_BANK_ACCOUNT ?? '',
    platformBankAccountName: process.env.PLATFORM_BANK_ACCOUNT_NAME ?? '',
    sepayWebhookApiKey: process.env.SEPAY_WEBHOOK_API_KEY ?? '',
    sepayIpAllowlist: (process.env.SEPAY_IP_ALLOWLIST ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  media: {
    signingSecret: process.env.MEDIA_SIGNING_SECRET ?? 'dev-media-signing',
    storageEndpoint: process.env.STORAGE_ENDPOINT ?? '',
    storageBucket: process.env.STORAGE_BUCKET ?? '',
  },
});
