import type { AdminAccessTokenResponse } from "@kimthanh-tutor/contracts";

export interface TokenStore {
  get(): AdminAccessTokenResponse | null;
  set(tokens: AdminAccessTokenResponse): void;
  clear(): void;
}

/** Token chỉ nằm trong RAM tab, không đưa token vào local/session storage. */
export function createMemoryTokenStore(
  initial: AdminAccessTokenResponse | null = null,
): TokenStore {
  let value = initial;
  return {
    get: () => value,
    set: (tokens) => {
      value = tokens;
    },
    clear: () => {
      value = null;
    },
  };
}
