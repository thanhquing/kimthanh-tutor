/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_DEV_DIAGNOSTICS?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_FACEBOOK_APP_ID?: string;
  readonly VITE_FACEBOOK_API_VERSION?: string;
  readonly VITE_MARKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
