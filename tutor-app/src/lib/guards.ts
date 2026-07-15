import type { ApiRole, UserStatus } from "@kimthanh-tutor/contracts";

export interface AuthSnapshot {
  authenticated: boolean;
  status?: UserStatus;
  roles: ApiRole[];
  acceptedLegalVersion?: string | null;
}

export interface RouteCapability {
  authenticated?: boolean;
  roles?: ApiRole[];
  legalVersion?: string;
}

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: "auth" | "consent" | "role" | "suspended"; redirectTo: string };

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
