import type {
  KeysetPage,
  TrialAcceptResponse,
  TrialActionInput,
  TrialDeclineInput,
  TrialMineQuery,
  TrialRequestSummary,
} from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

function queryString(query: TrialMineQuery): string {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  return params.toString();
}

export const trialsApi = {
  mine(query: TrialMineQuery = {}): Promise<KeysetPage<TrialRequestSummary>> {
    const search = queryString(query);
    return apiClient.request(`/trials/mine${search ? `?${search}` : ""}`);
  },
  accept(id: string, input: TrialActionInput): Promise<TrialAcceptResponse> {
    return apiClient.request(`/trials/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      body: input,
    });
  },
  decline(id: string, input: TrialDeclineInput): Promise<TrialRequestSummary> {
    return apiClient.request(`/trials/${encodeURIComponent(id)}/decline`, {
      method: "POST",
      body: input,
    });
  },
};
