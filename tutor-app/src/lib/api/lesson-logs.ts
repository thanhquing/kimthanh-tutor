import type {
  KeysetPage,
  LessonLogDetail,
  LessonLogInput,
  LessonLogsQuery,
  LessonLogUpdateInput,
} from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

function queryString(query: LessonLogsQuery): string {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  return params.toString();
}

export const lessonLogsApi = {
  list(classId: string, query: LessonLogsQuery = {}): Promise<KeysetPage<LessonLogDetail>> {
    const search = queryString(query);
    return apiClient.request(`/classes/${encodeURIComponent(classId)}/lesson-logs${search ? `?${search}` : ""}`);
  },
  create(classId: string, input: LessonLogInput): Promise<LessonLogDetail> {
    return apiClient.request(`/classes/${encodeURIComponent(classId)}/lesson-logs`, { method: "POST", body: input });
  },
  update(id: string, input: LessonLogUpdateInput): Promise<LessonLogDetail> {
    return apiClient.request(`/lesson-logs/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
  },
};
