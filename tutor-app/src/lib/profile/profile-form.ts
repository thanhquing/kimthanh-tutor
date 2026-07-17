import type { TutorProfileResponse } from "@kimthanh-tutor/contracts";
import type { TutorProfileWritePayload } from "../api/tutors";

/** Danh mục lựa chọn dùng chung cho form; code là tiếng Anh, nhãn tiếng Việt. */
export const SUBJECT_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "math", label: "Toán" },
  { code: "physics", label: "Vật lý" },
  { code: "chemistry", label: "Hóa" },
  { code: "biology", label: "Sinh" },
  { code: "literature", label: "Văn" },
  { code: "english", label: "Tiếng Anh" },
  { code: "history", label: "Lịch sử" },
  { code: "geography", label: "Địa lý" },
  { code: "informatics", label: "Tin học" },
];

export const GRADE_OPTIONS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

export const TEACHING_MODE_OPTIONS: Array<{ value: "online" | "offline"; label: string }> = [
  { value: "online", label: "Dạy online" },
  { value: "offline", label: "Dạy tại nhà (offline)" },
];

export const GENDER_OPTIONS: Array<{ value: "male" | "female" | "other"; label: string }> = [
  { value: "female", label: "Nữ" },
  { value: "male", label: "Nam" },
  { value: "other", label: "Khác" },
];

export interface OfflineAreaField {
  province_code: string;
  district_code: string;
}

export interface ProfileFormState {
  display_name: string;
  bio: string;
  region: string;
  voice_accent: string;
  gender: "" | "male" | "female" | "other";
  education_level: string;
  school_name: string;
  student_year: string;
  exam_score: string;
  gpa: string;
  expected_fee_min: string;
  expected_fee_max: string;
  subjects: string[];
  grade_levels: number[];
  teaching_modes: string[];
  offline_areas: OfflineAreaField[];
  avatar_media_id: string | null;
  intro_video_media_id: string | null;
}

export function emptyProfileForm(): ProfileFormState {
  return {
    display_name: "",
    bio: "",
    region: "",
    voice_accent: "",
    gender: "",
    education_level: "",
    school_name: "",
    student_year: "",
    exam_score: "",
    gpa: "",
    expected_fee_min: "",
    expected_fee_max: "",
    subjects: [],
    grade_levels: [],
    teaching_modes: [],
    offline_areas: [],
    avatar_media_id: null,
    intro_video_media_id: null,
  };
}

function numToInput(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}

export function profileToForm(profile: TutorProfileResponse): ProfileFormState {
  const gender = profile.gender;
  return {
    display_name: profile.display_name ?? "",
    bio: profile.bio ?? "",
    region: profile.region ?? "",
    voice_accent: profile.voice_accent ?? "",
    gender: gender === "male" || gender === "female" || gender === "other" ? gender : "",
    education_level: profile.education_level ?? "",
    school_name: profile.school_name ?? "",
    student_year: numToInput(profile.student_year),
    exam_score: numToInput(profile.exam_score),
    gpa: numToInput(profile.gpa),
    expected_fee_min: numToInput(profile.fee_min),
    expected_fee_max: numToInput(profile.fee_max),
    subjects: [...profile.subjects],
    grade_levels: [...profile.grade_levels],
    teaching_modes: [...profile.teaching_modes],
    offline_areas: profile.offline_areas.map((area) => ({
      province_code: area.province_code,
      district_code: area.district_code ?? "",
    })),
    avatar_media_id: profile.avatar_media_id,
    intro_video_media_id: profile.intro_video_media_id,
  };
}

function parseIntOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function parseNumberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function optionalText(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Chỉ gửi field có mặt/hợp lệ; mảng chuẩn hóa luôn gửi (server thay thế toàn bộ).
 * offline_areas chỉ gửi khi bật chế độ offline; district_code rỗng thì bỏ.
 */
export function formToPayload(form: ProfileFormState): TutorProfileWritePayload {
  const isOffline = form.teaching_modes.includes("offline");
  const payload: TutorProfileWritePayload = {
    display_name: form.display_name.trim(),
    subjects: [...new Set(form.subjects)],
    grade_levels: [...new Set(form.grade_levels)],
    teaching_modes: [...new Set(form.teaching_modes)],
    offline_areas: isOffline
      ? form.offline_areas
          .filter((area) => area.province_code.trim())
          .map((area) => ({
            province_code: area.province_code.trim(),
            ...(area.district_code.trim() ? { district_code: area.district_code.trim() } : {}),
          }))
      : [],
  };

  const bio = optionalText(form.bio);
  if (bio !== undefined) payload.bio = bio;
  const region = optionalText(form.region);
  if (region !== undefined) payload.region = region;
  const voiceAccent = optionalText(form.voice_accent);
  if (voiceAccent !== undefined) payload.voice_accent = voiceAccent;
  if (form.gender) payload.gender = form.gender;
  const educationLevel = optionalText(form.education_level);
  if (educationLevel !== undefined) payload.education_level = educationLevel;
  const schoolName = optionalText(form.school_name);
  if (schoolName !== undefined) payload.school_name = schoolName;

  const studentYear = parseIntOrUndefined(form.student_year);
  if (studentYear !== undefined) payload.student_year = studentYear;
  const examScore = parseNumberOrUndefined(form.exam_score);
  if (examScore !== undefined) payload.exam_score = examScore;
  const gpa = parseNumberOrUndefined(form.gpa);
  if (gpa !== undefined) payload.gpa = gpa;
  const feeMin = parseIntOrUndefined(form.expected_fee_min);
  if (feeMin !== undefined) payload.expected_fee_min = feeMin;
  const feeMax = parseIntOrUndefined(form.expected_fee_max);
  if (feeMax !== undefined) payload.expected_fee_max = feeMax;

  if (form.avatar_media_id) payload.avatar_media_id = form.avatar_media_id;
  if (form.intro_video_media_id) payload.intro_video_media_id = form.intro_video_media_id;

  return payload;
}

export type ProfileFieldErrors = Partial<Record<string, string>>;

/** Validation phía client trước khi lưu; server vẫn là nguồn enforcement cuối cùng. */
export function validateProfileForm(form: ProfileFormState): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  if (!form.display_name.trim()) {
    errors.display_name = "Nhập tên hiển thị cho hồ sơ.";
  }
  const feeMin = parseIntOrUndefined(form.expected_fee_min);
  const feeMax = parseIntOrUndefined(form.expected_fee_max);
  if (feeMin !== undefined && feeMin < 0) errors.expected_fee_min = "Học phí không được âm.";
  if (feeMax !== undefined && feeMax < 0) errors.expected_fee_max = "Học phí không được âm.";
  if (feeMin !== undefined && feeMax !== undefined && feeMin > feeMax) {
    errors.expected_fee_max = "Học phí tối đa phải lớn hơn hoặc bằng tối thiểu.";
  }
  const studentYear = parseIntOrUndefined(form.student_year);
  if (studentYear !== undefined && (studentYear < 1 || studentYear > 8)) {
    errors.student_year = "Năm học phải trong khoảng 1–8.";
  }
  const examScore = parseNumberOrUndefined(form.exam_score);
  if (examScore !== undefined && (examScore < 0 || examScore > 30)) {
    errors.exam_score = "Điểm thi phải trong khoảng 0–30.";
  }
  const gpa = parseNumberOrUndefined(form.gpa);
  if (gpa !== undefined && (gpa < 0 || gpa > 10)) {
    errors.gpa = "GPA phải trong khoảng 0–10.";
  }
  if (form.teaching_modes.includes("offline")) {
    const hasArea = form.offline_areas.some((area) => area.province_code.trim());
    if (!hasArea) errors.offline_areas = "Bật dạy offline thì cần ít nhất một khu vực.";
  }
  return errors;
}

export interface CompletenessItem {
  key: string;
  label: string;
  ok: boolean;
}

export interface Completeness {
  items: CompletenessItem[];
  done: number;
  total: number;
  publishable: boolean;
}

/**
 * Checklist phản chiếu điều kiện publish của server (bio, fee_min, subjects,
 * grade_levels, teaching_modes) cộng các ràng buộc client rõ ràng. Không tự đặt
 * trạng thái; chỉ gợi ý — server quyết định khi publish.
 */
export function evaluateCompleteness(form: ProfileFormState): Completeness {
  const feeMin = parseIntOrUndefined(form.expected_fee_min);
  const feeMax = parseIntOrUndefined(form.expected_fee_max);
  const offlineOk =
    !form.teaching_modes.includes("offline") ||
    form.offline_areas.some((area) => area.province_code.trim());
  const items: CompletenessItem[] = [
    { key: "display_name", label: "Tên hiển thị", ok: !!form.display_name.trim() },
    { key: "bio", label: "Giới thiệu bản thân", ok: !!form.bio.trim() },
    { key: "subjects", label: "Ít nhất một môn dạy", ok: form.subjects.length > 0 },
    { key: "grade_levels", label: "Ít nhất một cấp lớp", ok: form.grade_levels.length > 0 },
    { key: "teaching_modes", label: "Ít nhất một hình thức dạy", ok: form.teaching_modes.length > 0 },
    { key: "fee", label: "Học phí hợp lệ (min ≤ max)", ok: feeMin != null && (feeMax == null || feeMin <= feeMax) },
    { key: "offline_areas", label: "Khu vực offline (nếu dạy offline)", ok: offlineOk },
  ];
  const done = items.filter((item) => item.ok).length;
  return { items, done, total: items.length, publishable: done === items.length };
}
