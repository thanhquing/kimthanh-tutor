import type { AuthMeResponse } from "@kimthanh-tutor/contracts";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { decideRouteAccess } from "../lib/guards";
import { consentPath, loginPath } from "../lib/redirects";
import { SessionErrorPage, LoadingAccessPage } from "../pages/AccessStatePages";
import { useAuth } from "./AuthContext";

export function TutorAccessGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <LoadingAccessPage />;
  if (auth.sessionError) return <SessionErrorPage message={auth.sessionError} retry={auth.loadMe} />;
  if (auth.accountUnavailable) return <Navigate to="/account-unavailable" replace />;
  return <TutorAccess me={auth.me} pathname={location.pathname} search={location.search}>{children}</TutorAccess>;
}

export function TutorAccess({
  me,
  pathname,
  search = "",
  children,
}: {
  me: AuthMeResponse | null;
  pathname: string;
  search?: string;
  children: ReactNode;
}) {
  const next = `${pathname}${search}`;
  const snapshot = {
    authenticated: me !== null,
    status: me?.user.status,
    roles: me?.roles ?? [],
  };
  const baseDecision = decideRouteAccess(snapshot, { authenticated: true });
  if (!baseDecision.allowed) {
    if (baseDecision.reason === "auth") return <Navigate to={loginPath(next)} replace />;
    if (baseDecision.reason === "consent") return <Navigate to={consentPath(next)} replace />;
    if (baseDecision.reason === "suspended") return <Navigate to="/account-unavailable" replace />;
  }
  if (!me) return null;

  const canBootstrapTutor = me.profiles.tutor === null && (me.roles.length === 0 || me.roles.includes("tutor"));
  if (canBootstrapTutor) {
    if (pathname === "/profile" || pathname.startsWith("/profile/")) return <>{children}</>;
    return <Navigate to="/profile" replace />;
  }

  const roleDecision = decideRouteAccess(snapshot, { authenticated: true, roles: ["tutor"] });
  if (!roleDecision.allowed) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
