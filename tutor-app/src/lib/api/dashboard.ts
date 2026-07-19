import type { TutorDashboardOverview } from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

export const dashboardApi = {
  tutorOverview() {
    return apiClient.request<TutorDashboardOverview>("/dashboard/tutor/overview");
  },
};
