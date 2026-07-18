"use client";

import type {
  AuthForgotPasswordResponse,
  AuthMeResponse,
  AuthRegisterResponse,
  AuthResetPasswordResponse,
  AuthVerifyEmailResponse,
  AuthVerifyResponse,
  RecordLegalConsent,
} from "@kimthanh-tutor/contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/lib/api/auth";
import { appTokenStore } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/errors";

interface AuthContextValue {
  me: AuthMeResponse | null;
  loading: boolean;
  sessionError: string | null;
  accountUnavailable: boolean;
  register: (email: string, password: string) => Promise<AuthRegisterResponse>;
  login: (email: string, password: string) => Promise<AuthMeResponse>;
  verifyEmail: (token: string) => Promise<AuthVerifyEmailResponse>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<AuthForgotPasswordResponse>;
  resetPassword: (token: string, password: string) => Promise<AuthResetPasswordResponse>;
  recordConsent: (payload: RecordLegalConsent) => Promise<AuthMeResponse | null>;
  loadMe: () => Promise<AuthMeResponse | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [accountUnavailable, setAccountUnavailable] = useState(false);

  const clearLocalSession = useCallback(() => {
    appTokenStore.clear();
    setMe(null);
    setSessionError(null);
    setAccountUnavailable(false);
    setLoading(false);
  }, []);

  const loadMe = useCallback(async () => {
    if (!appTokenStore.get()) {
      setMe(null);
      setLoading(false);
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
    appTokenStore.set({ access_token: verified.access_token, refresh_token: verified.refresh_token });
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

  const register = useCallback((email: string, password: string) => authApi.register({ email, password }), []);
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
  const recordConsent = useCallback(async (payload: RecordLegalConsent) => {
    await authApi.recordConsent(payload);
    return loadMe();
  }, [loadMe]);
  const logout = useCallback(() => {
    void authApi.logout();
    clearLocalSession();
  }, [clearLocalSession]);

  useEffect(() => {
    if (appTokenStore.get()) void loadMe();
  }, [loadMe]);

  const value = useMemo<AuthContextValue>(() => ({
    me, loading, sessionError, accountUnavailable,
    register, login, verifyEmail, resendVerification, forgotPassword, resetPassword,
    recordConsent, loadMe, logout,
  }), [
    accountUnavailable, forgotPassword, loadMe, loading, login, logout, me,
    recordConsent, register, resendVerification, resetPassword, sessionError, verifyEmail,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
