import type { ReactNode } from "react";
import type { AuthMeResponse } from "@kimthanh-tutor/contracts";
import { useAuth } from "./AuthContext";
import { ConsentRequiredPage, ForbiddenPage, LoadingAccessPage, SuspendedPage } from "../pages/AccessStatePages";
import { LoginPage } from "../pages/LoginPage";

export function AuthGate({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <LoadingAccessPage />;
  return <AdminAccess me={me}>{children}</AdminAccess>;
}

/** Pure gate để route protected không render shell/dữ liệu trước khi RBAC hoàn tất. */
export function AdminAccess({ me, children }: { me: AuthMeResponse | null; children: ReactNode }) {
  if (!me) return <LoginPage />;
  if (me.user.status === "pending_consent") return <ConsentRequiredPage />;
  if (me.user.status === "suspended") return <SuspendedPage />;
  if (!me.roles.includes("admin")) return <ForbiddenPage />;
  return <>{children}</>;
}
