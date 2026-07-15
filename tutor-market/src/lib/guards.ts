import type { ApiRole, UserStatus } from "@kimthanh-tutor/contracts";

export interface AuthSnapshot {
  authenticated: boolean;
  roles: ApiRole[];
  status?: UserStatus;
  acceptedLegalVersion?: string | null;
}

export interface RouteCapability {
  authenticated?: boolean;
  roles?: ApiRole[];
  legalVersion?: string;
}

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: "auth" | "role" | "consent" | "suspended"; redirectTo: string };

export function decideRouteAccess(auth: AuthSnapshot, capability: RouteCapability): GuardDecision {
  if (capability.authenticated && !auth.authenticated) return { allowed: false, reason: "auth", redirectTo: "/login" };
  if (auth.status === "suspended" || auth.status === "deleted") return { allowed: false, reason: "suspended", redirectTo: "/account-unavailable" };
  if (auth.status === "pending_consent" || (capability.legalVersion && auth.acceptedLegalVersion !== capability.legalVersion)) {
    return { allowed: false, reason: "consent", redirectTo: "/consent" };
  }
  if (capability.roles?.length && !capability.roles.some((role) => auth.roles.includes(role))) {
    return { allowed: false, reason: "role", redirectTo: "/forbidden" };
  }
  return { allowed: true };
}

const safeNextPaths = new Set(["/account", "/students", "/classes", "/dashboard", "/billing", "/checkout", "/notifications"]);

export function safeInternalNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  const path = value.split("?")[0];
  return [...safeNextPaths].some((allowed) => path === allowed || path.startsWith(`${allowed}/`)) ? value : fallback;
}
