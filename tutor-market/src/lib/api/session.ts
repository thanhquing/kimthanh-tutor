import type { AuthAccessTokenResponse } from "@kimthanh-tutor/contracts";

export interface TokenStore { get(): AuthAccessTokenResponse | null; set(tokens: AuthAccessTokenResponse): void; clear(): void; }

/**
 * Chỉ giữ access token ngắn hạn trong RAM tab (không local/session storage —
 * chống XSS đọc trộm). Refresh token nằm trong cookie HttpOnly `kt_refresh`;
 * boot app gọi `/auth/refresh` để khôi phục phiên qua reload.
 */
export function createMemoryTokenStore(): TokenStore {
  let tokens: AuthAccessTokenResponse | null = null;
  return { get: () => tokens, set: (value) => { tokens = value; }, clear: () => { tokens = null; } };
}
