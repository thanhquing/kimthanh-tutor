const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";

export const appConfig = Object.freeze({
  apiBaseUrl: rawApiBase.replace(/\/$/, ""),
  devDiagnostics: import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_DIAGNOSTICS === "true",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "",
  facebookAppId: import.meta.env.VITE_FACEBOOK_APP_ID?.trim() ?? "",
  facebookApiVersion: import.meta.env.VITE_FACEBOOK_API_VERSION?.trim() || "v21.0",
  marketUrl: (import.meta.env.VITE_MARKET_URL?.trim() || "http://localhost:3001").replace(/\/$/, ""),
});
