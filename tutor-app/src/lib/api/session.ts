import type { AuthTokens } from "@kimthanh-tutor/contracts";

export interface TokenStore {
  get(): AuthTokens | null;
  set(tokens: AuthTokens): void;
  clear(): void;
}

export function createMemoryTokenStore(initial: AuthTokens | null = null): TokenStore {
  let value = initial;
  return {
    get: () => value,
    set: (tokens) => { value = tokens; },
    clear: () => { value = null; },
  };
}
