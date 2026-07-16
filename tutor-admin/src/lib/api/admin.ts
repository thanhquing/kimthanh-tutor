import type { AdminKeysetPage, AdminKeysetQuery, AdminPaidFeatureMutation, AdminUserStatusMutation } from "@kimthanh-tutor/contracts";
import type { ApiClient } from "./client";

function queryString(query: object) {
  const params = new URLSearchParams();
  Object.entries(query as Record<string, string | number | undefined>).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  const result = params.toString();
  return result ? `?${result}` : "";
}

/** Các route feature dùng lại client typed này, không tự ghép URL hay bypass error handling. */
export class AdminApi {
  constructor(private readonly client: ApiClient) {}

  overview(signal?: AbortSignal) { return this.client.request<unknown>("/admin/overview", { signal }); }
  users(query: AdminKeysetQuery & { role?: string; status?: string; q?: string } = {}, signal?: AbortSignal) {
    return this.client.request<AdminKeysetPage<unknown>>(`/admin/users${queryString(query)}`, { signal });
  }
  setUserStatus(userId: string, body: AdminUserStatusMutation, signal?: AbortSignal) {
    return this.client.request<unknown>(`/admin/users/${encodeURIComponent(userId)}/status`, { method: "PATCH", body, signal });
  }
  payments(query: AdminKeysetQuery & { status?: string; product_type?: string } = {}, signal?: AbortSignal) {
    return this.client.request<AdminKeysetPage<unknown>>(`/admin/payments${queryString(query)}`, { signal });
  }
  systemLogs(query: AdminKeysetQuery & { type: "audit" | "webhook" | "outbox"; status?: string } , signal?: AbortSignal) {
    return this.client.request<AdminKeysetPage<unknown>>(`/admin/system-logs${queryString(query)}`, { signal });
  }
  setPaidFeature(userId: string, feature: string, body: AdminPaidFeatureMutation, signal?: AbortSignal) {
    return this.client.request<unknown>(`/admin/users/${encodeURIComponent(userId)}/paid-features/${encodeURIComponent(feature)}`, { method: "PATCH", body, signal });
  }
}
