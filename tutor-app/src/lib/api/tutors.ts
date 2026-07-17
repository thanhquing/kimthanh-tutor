import type {
  MediaAssetStatus,
  MediaUploadRequest,
  MediaUploadResponse,
  TutorProfilePublishResponse,
  TutorProfileResponse,
} from "@kimthanh-tutor/contracts";
import { apiClient } from "./client";

/** Payload gửi lên `POST`/`PATCH` hồ sơ; các trường optional chỉ gửi khi có mặt. */
export interface TutorProfileWritePayload {
  display_name?: string;
  bio?: string;
  region?: string;
  voice_accent?: string;
  gender?: string;
  education_level?: string;
  school_name?: string;
  student_year?: number;
  exam_score?: number;
  gpa?: number;
  expected_fee_min?: number;
  expected_fee_max?: number;
  avatar_media_id?: string;
  intro_video_media_id?: string;
  subjects?: string[];
  grade_levels?: number[];
  teaching_modes?: string[];
  offline_areas?: Array<{ province_code: string; district_code?: string }>;
}

export const tutorApi = {
  getMyProfile() {
    return apiClient.request<TutorProfileResponse>("/tutors/me/profile");
  },
  createProfile(payload: TutorProfileWritePayload) {
    return apiClient.request<TutorProfileResponse>("/tutors/me/profile", {
      method: "POST",
      body: payload,
    });
  },
  updateProfile(payload: TutorProfileWritePayload) {
    return apiClient.request<TutorProfileResponse>("/tutors/me/profile", {
      method: "PATCH",
      body: payload,
    });
  },
  publish() {
    return apiClient.request<TutorProfilePublishResponse>(
      "/tutors/me/profile/publish",
      { method: "POST" },
    );
  },
  createUploadUrl(payload: MediaUploadRequest) {
    return apiClient.request<MediaUploadResponse>("/media/upload-url", {
      method: "POST",
      body: payload,
    });
  },
  mediaStatus(mediaId: string) {
    return apiClient.request<MediaAssetStatus>(`/media/${mediaId}`);
  },
  // PUT trực tiếp lên signed URL do storage cấp; không đi qua API base.
  async putToSignedUrl(uploadUrl: string, file: File | Blob, contentType: string) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Tải tệp lên thất bại (HTTP ${response.status}).`);
    }
  },
};
