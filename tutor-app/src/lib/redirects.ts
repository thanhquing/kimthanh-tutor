import type { AuthMeResponse } from "@kimthanh-tutor/contracts";

const protectedRoots = [
  "/dashboard",
  "/profile",
  "/availability",
  "/trials",
  "/classes",
  "/lesson-logs",
  "/billing",
  "/payout-accounts",
  "/qr-records",
  "/notifications",
  "/settings",
] as const;

export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw, "https://tutor.local");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "https://tutor.local") return fallback;
  const allowed = protectedRoots.some((root) => parsed.pathname === root || parsed.pathname.startsWith(`${root}/`));
  return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
}

export function loginPath(next: string) {
  return `/login?${new URLSearchParams({ next: safeNextPath(next) }).toString()}`;
}

export function consentPath(next: string) {
  return `/consent?${new URLSearchParams({ next: safeNextPath(next) }).toString()}`;
}

export function routeAfterAuth(me: AuthMeResponse, requestedNext?: string | null) {
  if (me.user.status === "pending_consent") return consentPath(safeNextPath(requestedNext));
  if (me.user.status === "suspended" || me.user.status === "deleted") return "/account-unavailable";
  if (me.profiles.tutor === null && (me.roles.length === 0 || me.roles.includes("tutor"))) return "/profile";
  if (!me.roles.includes("tutor")) return "/forbidden";
  return safeNextPath(requestedNext);
}
