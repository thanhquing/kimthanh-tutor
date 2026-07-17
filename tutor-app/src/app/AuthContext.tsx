import type {
  AuthMeResponse,
  AuthOtpRequest,
  AuthOtpRequestResponse,
  AuthVerifyResponse,
} from "@kimthanh-tutor/contracts";
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
import { authApi } from "../lib/api/auth";
import { appTokenStore, setSessionExpiredHandler } from "../lib/api/client";
import { ApiClientError } from "../lib/api/errors";
import { disableGoogleAutoSelect } from "../lib/oauth";

interface AuthContextValue {
  me: AuthMeResponse | null;
  loading: boolean;
  sessionError: string | null;
  accountUnavailable: boolean;
  loginWithGoogleToken: (idToken: string) => Promise<AuthMeResponse>;
  loginWithFacebookToken: (accessToken: string) => Promise<AuthMeResponse>;
  requestOtp: (payload: AuthOtpRequest) => Promise<AuthOtpRequestResponse>;
  verifyOtp: (requestId: string, code: string) => Promise<AuthMeResponse>;
  loadMe: () => Promise<AuthMeResponse | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(() => appTokenStore.get() !== null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [accountUnavailable, setAccountUnavailable] = useState(false);
  const queryClient = useQueryClient();

  const clearLocalSession = useCallback(() => {
    appTokenStore.clear();
    queryClient.clear();
    setMe(null);
    setSessionError(null);
    setAccountUnavailable(false);
    setLoading(false);
  }, [queryClient]);

  const loadMe = useCallback(async () => {
    if (!appTokenStore.get()) {
      setLoading(false);
      setMe(null);
      return null;
    }
    setLoading(true);
    setSessionError(null);
    try {
      const response = await authApi.me();
      setMe(response);
      return response;
    } catch (error) {
      if (error instanceof ApiClientError && (error.status === 401 || error.code === "AUTH_REQUIRED")) {
        clearLocalSession();
      } else {
        setMe(null);
        setSessionError(error instanceof Error ? error.message : "Không thể xác minh phiên đăng nhập.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);

  const completeLogin = useCallback(async (verified: AuthVerifyResponse) => {
    if (verified.user.status === "suspended" || verified.user.status === "deleted") {
      appTokenStore.clear();
      setAccountUnavailable(true);
      throw new Error("Tài khoản hiện không khả dụng.");
    }
    appTokenStore.set({
      access_token: verified.access_token,
      refresh_token: verified.refresh_token,
    });
    try {
      const response = await authApi.me();
      setMe(response);
      setSessionError(null);
      setAccountUnavailable(false);
      return response;
    } catch (error) {
      clearLocalSession();
      throw error;
    }
  }, [clearLocalSession]);

  const loginWithGoogleToken = useCallback(
    async (idToken: string) => completeLogin(await authApi.google({ id_token: idToken })),
    [completeLogin],
  );
  const loginWithFacebookToken = useCallback(
    async (accessToken: string) => completeLogin(await authApi.facebook({ access_token: accessToken })),
    [completeLogin],
  );
  const requestOtp = useCallback((payload: AuthOtpRequest) => authApi.requestOtp(payload), []);
  const verifyOtp = useCallback(
    async (requestId: string, code: string) => completeLogin(await authApi.verifyOtp({ request_id: requestId, code })),
    [completeLogin],
  );
  const logout = useCallback(() => {
    void authApi.logout();
    disableGoogleAutoSelect();
    clearLocalSession();
  }, [clearLocalSession]);

  useEffect(() => {
    if (appTokenStore.get()) void loadMe();
  }, [loadMe]);
  useEffect(() => {
    setSessionExpiredHandler(clearLocalSession);
    return () => setSessionExpiredHandler();
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(() => ({
    me,
    loading,
    sessionError,
    accountUnavailable,
    loginWithGoogleToken,
    loginWithFacebookToken,
    requestOtp,
    verifyOtp,
    loadMe,
    logout,
  }), [
    accountUnavailable,
    loadMe,
    loading,
    loginWithFacebookToken,
    loginWithGoogleToken,
    logout,
    me,
    requestOtp,
    sessionError,
    verifyOtp,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
