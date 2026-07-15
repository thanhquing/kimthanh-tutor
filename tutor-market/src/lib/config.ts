const fallbackSiteUrl = "http://localhost:3001";

export const marketConfig = {
  apiBaseUrl: (process.env.API_BASE_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, ""),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? fallbackSiteUrl).replace(/\/$/, ""),
  isDevelopment: process.env.NODE_ENV !== "production",
  useDevFixtures: process.env.NODE_ENV !== "production" && process.env.MARKET_DEV_FIXTURES === "true",
};

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${marketConfig.siteUrl}/`).toString();
}
