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
    facebookAppId: string;
    facebookAppSecret: string;
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
    facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
    facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? '',
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
