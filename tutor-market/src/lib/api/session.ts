import type { AuthTokens } from "@kimthanh-tutor/contracts";

export interface TokenStore { get(): AuthTokens | null; set(tokens: AuthTokens): void; clear(): void; }

export function createMemoryTokenStore(): TokenStore {
  let tokens: AuthTokens | null = null;
  return { get: () => tokens, set: (value) => { tokens = value; }, clear: () => { tokens = null; } };
}
