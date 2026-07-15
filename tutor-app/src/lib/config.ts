const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";

export const appConfig = Object.freeze({
  apiBaseUrl: rawApiBase.replace(/\/$/, ""),
  devDiagnostics: import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_DIAGNOSTICS === "true",
});
