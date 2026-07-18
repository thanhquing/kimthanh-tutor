"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { decideRouteAccess, type GuardDecision } from "@/lib/guards";

/**
 * Cổng client cho khu vực phụ huynh: token memory-only nên không SSR dữ liệu
 * riêng tư — chờ hydrate rồi mới quyết định. Chưa đăng nhập → /login; chưa
 * consent → /consent; bị khóa → /account-unavailable. (Không bắt role parent ở
 * đây: hồ sơ phụ huynh được bootstrap ở TM-04.)
 */
export function PrivateGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const me = auth.me;
  const decision = useMemo<GuardDecision>(
    () =>
      me
        ? decideRouteAccess(
            { authenticated: true, roles: me.roles, status: me.user.status },
            { authenticated: true },
          )
        : { allowed: false, reason: "auth", redirectTo: "/login" },
    [me],
  );

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.me) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!decision.allowed) router.replace(decision.redirectTo);
  }, [auth.loading, auth.me, decision, pathname, router]);

  if (auth.loading || !auth.me || !decision.allowed) {
    return <section className="page state"><p>Đang kiểm tra phiên đăng nhập…</p></section>;
  }
  return <>{children}</>;
}
