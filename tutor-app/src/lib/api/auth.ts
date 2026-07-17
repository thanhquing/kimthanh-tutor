import type {
  ActiveLegalDocumentsResponse,
  AuthFacebookOAuth,
  AuthGoogleOAuth,
  AuthMeResponse,
  AuthOtpRequest,
  AuthOtpRequestResponse,
  AuthOtpVerify,
  AuthVerifyResponse,
  RecordLegalConsent,
  RecordLegalConsentResponse,
} from "@kimthanh-tutor/contracts";
import { apiClient, appTokenStore } from "./client";

export const authApi = {
  google(payload: AuthGoogleOAuth) {
    return apiClient.request<AuthVerifyResponse>("/auth/oauth/google", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  facebook(payload: AuthFacebookOAuth) {
    return apiClient.request<AuthVerifyResponse>("/auth/oauth/facebook", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  requestOtp(payload: AuthOtpRequest) {
    return apiClient.request<AuthOtpRequestResponse>("/auth/otp/request", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  verifyOtp(payload: AuthOtpVerify) {
    return apiClient.request<AuthVerifyResponse>("/auth/otp/verify", {
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
    const refreshToken = appTokenStore.get()?.refresh_token;
    appTokenStore.clear();
    if (!refreshToken) return Promise.resolve();
    return apiClient.request<void>("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
      skipAuth: true,
    }).catch(() => undefined);
  },
};
