import type { ApiRole, UserStatus } from "@kimthanh-tutor/contracts";

export interface AuthSnapshot {
  authenticated: boolean;
  status?: UserStatus;
  roles: ApiRole[];
}

export interface RouteCapability {
  authenticated?: boolean;
  roles?: ApiRole[];
}

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: "auth" | "consent" | "role" | "suspended"; redirectTo: string };

export function decideRouteAccess(auth: AuthSnapshot, capability: RouteCapability): GuardDecision {
  if (capability.authenticated && !auth.authenticated) return { allowed: false, reason: "auth", redirectTo: "/login" };
  if (auth.status === "suspended" || auth.status === "deleted") return { allowed: false, reason: "suspended", redirectTo: "/account-unavailable" };
  // Consent là gate một lần theo status; backend không revert active → pending khi
  // đổi version (xem consent.service + /auth/me không trả legal version). Version
  // drift được xử lý lúc submit consent (VALIDATION_ERROR), không phải ở gate.
  if (auth.status === "pending_consent") {
    return { allowed: false, reason: "consent", redirectTo: "/consent" };
  }
  if (capability.roles?.length && !capability.roles.some((role) => auth.roles.includes(role))) {
    return { allowed: false, reason: "role", redirectTo: "/forbidden" };
  }
  return { allowed: true };
}
