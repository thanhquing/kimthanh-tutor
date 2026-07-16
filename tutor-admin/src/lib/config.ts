const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";
const parsedIdleTimeout = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS || 900_000);

export const appConfig = Object.freeze({
  apiBaseUrl: rawApiBase.replace(/\/$/, ""),
  buildEnvironment: import.meta.env.VITE_BUILD_ENV?.trim() || import.meta.env.MODE,
  idleTimeoutMs: Number.isFinite(parsedIdleTimeout) && parsedIdleTimeout >= 60_000 ? parsedIdleTimeout : 900_000,
});
