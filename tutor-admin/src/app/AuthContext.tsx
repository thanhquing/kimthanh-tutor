import type { AuthMeResponse } from "@kimthanh-tutor/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { appConfig } from "../lib/config";
import { authApi, adminTokenStore } from "../lib/auth";

interface AuthContextValue {
  me: AuthMeResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthMeResponse>;
  loadMe: () => Promise<AuthMeResponse | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const clearLocalSession = useCallback(() => {
    adminTokenStore.clear();
    queryClient.clear();
    setMe(null);
    setLoading(false);
  }, [queryClient]);
  const logout = useCallback(() => {
    authApi.logout();
    clearLocalSession();
  }, [clearLocalSession]);
  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      if (!adminTokenStore.get()) await authApi.restore();
      const response = await authApi.me();
      setMe(response);
      return response;
    } catch {
      // Lỗi mạng/5xx không được biến thành server-side logout. Cookie HttpOnly
      // còn hợp lệ sẽ cho phép reload/retry phục hồi phiên.
      clearLocalSession();
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);
  const completeLogin = useCallback(
    async (verified: Awaited<ReturnType<typeof authApi.passwordLogin>>) => {
      if (verified.user.status === "suspended") {
        authApi.logout();
        throw new Error("Tài khoản đã bị tạm ngưng.");
      }
      adminTokenStore.set(verified);
      try {
        const response = await authApi.me();
        setMe(response);
        setLoading(false);
        return response;
      } catch (error) {
        clearLocalSession();
        throw error;
      }
    },
    [clearLocalSession],
  );
  const login = useCallback(
    async (email: string, password: string) =>
      completeLogin(await authApi.passwordLogin({ email, password })),
    [completeLogin],
  );

  useEffect(() => {
    void loadMe();
  }, [loadMe]);
  useEffect(() => {
    authApi.setSessionExpiredHandler(clearLocalSession);
    return () => authApi.setSessionExpiredHandler();
  }, [clearLocalSession]);
  useEffect(() => {
    if (!me) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(logout, appConfig.idleTimeoutMs);
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) =>
      window.addEventListener(event, schedule, { passive: true }),
    );
    schedule();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, schedule));
    };
  }, [logout, me]);

  const value = useMemo(
    () => ({ me, loading, login, loadMe, logout }),
    [login, loadMe, loading, logout, me],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
