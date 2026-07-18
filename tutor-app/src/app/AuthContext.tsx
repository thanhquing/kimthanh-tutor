import type {
  AuthForgotPasswordResponse,
  AuthMeResponse,
  AuthRegisterResponse,
  AuthResetPasswordResponse,
  AuthVerifyEmailResponse,
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
  register: (email: string, password: string) => Promise<AuthRegisterResponse>;
  login: (email: string, password: string) => Promise<AuthMeResponse>;
  verifyEmail: (token: string) => Promise<AuthVerifyEmailResponse>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<AuthForgotPasswordResponse>;
  resetPassword: (token: string, password: string) => Promise<AuthResetPasswordResponse>;
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
  const register = useCallback(
    (email: string, password: string) => authApi.register({ email, password }),
    [],
  );
  const login = useCallback(
    async (email: string, password: string) => completeLogin(await authApi.login({ email, password })),
    [completeLogin],
  );
  const verifyEmail = useCallback((token: string) => authApi.verifyEmail({ token }), []);
  const resendVerification = useCallback(async (email: string) => {
    await authApi.resendVerification({ email });
  }, []);
  const forgotPassword = useCallback((email: string) => authApi.forgotPassword({ email }), []);
  const resetPassword = useCallback(
    (token: string, password: string) => authApi.resetPassword({ token, password }),
    [],
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
    register,
    login,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    loadMe,
    logout,
  }), [
    accountUnavailable,
    forgotPassword,
    loadMe,
    loading,
    login,
    loginWithFacebookToken,
    loginWithGoogleToken,
    logout,
    me,
    register,
    resendVerification,
    resetPassword,
    sessionError,
    verifyEmail,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
