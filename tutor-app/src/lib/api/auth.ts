import type {
  ActiveLegalDocumentsResponse,
  AuthFacebookOAuth,
  AuthForgotPasswordRequest,
  AuthForgotPasswordResponse,
  AuthGoogleOAuth,
  AuthLoginRequest,
  AuthMeResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthResendVerificationRequest,
  AuthResendVerificationResponse,
  AuthResetPasswordRequest,
  AuthResetPasswordResponse,
  AuthSessionResponse,
  AuthVerifyEmailRequest,
  AuthVerifyEmailResponse,
  RecordLegalConsent,
  RecordLegalConsentResponse,
} from "@kimthanh-tutor/contracts";
import { apiClient, appTokenStore } from "./client";

export const authApi = {
  register(payload: AuthRegisterRequest) {
    return apiClient.request<AuthRegisterResponse>("/auth/register", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  login(payload: AuthLoginRequest) {
    return apiClient.request<AuthSessionResponse>("/auth/login", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  verifyEmail(payload: AuthVerifyEmailRequest) {
    return apiClient.request<AuthVerifyEmailResponse>("/auth/email/verify", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  resendVerification(payload: AuthResendVerificationRequest) {
    return apiClient.request<AuthResendVerificationResponse>("/auth/email/verify/resend", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  forgotPassword(payload: AuthForgotPasswordRequest) {
    return apiClient.request<AuthForgotPasswordResponse>("/auth/password/forgot", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  resetPassword(payload: AuthResetPasswordRequest) {
    return apiClient.request<AuthResetPasswordResponse>("/auth/password/reset", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  google(payload: AuthGoogleOAuth) {
    return apiClient.request<AuthSessionResponse>("/auth/oauth/google", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  facebook(payload: AuthFacebookOAuth) {
    return apiClient.request<AuthSessionResponse>("/auth/oauth/facebook", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  me() {
    return apiClient.request<AuthMeResponse>("/auth/me");
  },
  activeLegalDocuments() {
    return apiClient.request<ActiveLegalDocumentsResponse>("/legal/documents/active", {
      skipAuth: true,
    });
  },
  recordConsent(payload: RecordLegalConsent) {
    return apiClient.request<RecordLegalConsentResponse>("/legal/consents", {
      method: "POST",
      body: payload,
    });
  },
  logout() {
    // Refresh token nằm trong cookie HttpOnly; server đọc cookie để revoke + clear.
    appTokenStore.clear();
    return apiClient.request<void>("/auth/logout", {
      method: "POST",
      skipAuth: true,
    }).catch(() => undefined);
  },
};
