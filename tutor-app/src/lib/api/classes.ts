import type {
  ClassDetail,
  ClassesMineQuery,
  ClassTransitionInput,
  KeysetPage,
} from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

function queryString(query: ClassesMineQuery): string {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  return params.toString();
}

export const classesApi = {
  mine(query: ClassesMineQuery = {}): Promise<KeysetPage<ClassDetail>> {
    const search = queryString(query);
    return apiClient.request(`/classes/mine${search ? `?${search}` : ""}`);
  },
  detail(id: string): Promise<ClassDetail> {
    return apiClient.request(`/classes/${encodeURIComponent(id)}`);
  },
  transition(id: string, input: ClassTransitionInput): Promise<ClassDetail> {
    return apiClient.request(`/classes/${encodeURIComponent(id)}/transition`, {
      method: "POST",
      body: input,
    });
  },
};
