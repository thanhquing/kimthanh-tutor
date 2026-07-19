import type { AuthAccessTokenResponse } from "@kimthanh-tutor/contracts";

export interface TokenStore {
  get(): AuthAccessTokenResponse | null;
  set(tokens: AuthAccessTokenResponse): void;
  clear(): void;
}

/**
 * Chỉ giữ access token ngắn hạn trong RAM tab — không local/session storage
 * (chống XSS đọc trộm). Refresh token nằm trong cookie HttpOnly `kt_refresh`
 * do server quản lý; boot app gọi `/auth/refresh` để khôi phục phiên qua reload.
 */
export function createMemoryTokenStore(initial: AuthAccessTokenResponse | null = null): TokenStore {
  let value = initial;
  return {
    get: () => value,
    set: (tokens) => { value = tokens; },
    clear: () => { value = null; },
  };
}
