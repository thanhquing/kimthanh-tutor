import type { AvailabilityType, TutorAvailability } from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

export interface AvailabilityCreatePayload {
  day_of_week: number;
  start_time: string;
  end_time: string;
  type?: AvailabilityType;
  note?: string;
}

export const availabilityApi = {
  list() {
    return apiClient.request<{ items: TutorAvailability[] }>("/tutors/me/availabilities");
  },
  create(payload: AvailabilityCreatePayload) {
    return apiClient.request<{ id: string }>("/tutors/me/availabilities", {
      method: "POST",
      body: payload,
    });
  },
  remove(id: string) {
    return apiClient.request<{ ok: boolean }>(`/tutors/me/availabilities/${id}`, {
      method: "DELETE",
    });
  },
};
