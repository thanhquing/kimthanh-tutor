import type {
  AdminAccessTokenResponse,
  AdminAuthResponse,
  AdminPasswordLogin,
  AuthMeResponse,
} from "@kimthanh-tutor/contracts";
import { ApiClient } from "./api/client";
import { createMemoryTokenStore } from "./api/session";

export const adminTokenStore = createMemoryTokenStore();
let sessionExpiredHandler: (() => void) | undefined;
export const adminApiClient = new ApiClient({
  tokenStore: adminTokenStore,
  onSessionExpired: () => sessionExpiredHandler?.(),
});

export const authApi = {
  passwordLogin(payload: AdminPasswordLogin): Promise<AdminAuthResponse> {
    return adminApiClient.request<AdminAuthResponse>("/auth/admin/password", {
      method: "POST",
      body: payload,
      skipAuth: true,
    });
  },
  restore(): Promise<AdminAccessTokenResponse> {
    return adminApiClient.restoreSession();
  },
  me(): Promise<AuthMeResponse> {
    return adminApiClient.request<AuthMeResponse>("/auth/me");
  },
  logout() {
    adminTokenStore.clear();
    void adminApiClient
      .request<void>("/auth/admin/logout", { method: "POST", skipAuth: true })
      .catch(() => undefined);
  },
  setSessionExpiredHandler(handler?: () => void) {
    sessionExpiredHandler = handler;
  },
};
