import type { TutorProfileResponse } from "@kimthanh-tutor/contracts";
import { describe, expect, it } from "vitest";
import {
  emptyProfileForm,
  evaluateCompleteness,
  formToPayload,
  type ProfileFormState,
  profileToForm,
  validateProfileForm,
} from "./profile-form";

const serverProfile: TutorProfileResponse = {
  id: "tutor-1",
  display_name: "Cô Linh",
  bio: "Gia sư Toán cấp 2",
  region: "Hà Nội",
  voice_accent: "mien_bac",
  gender: "female",
  education_level: "university",
  school_name: "ĐHSP Hà Nội",
  student_year: 3,
  exam_score: 27.5,
  gpa: 3.4,
  fee_min: 180000,
  fee_max: 250000,
  avatar_media_id: "media-avatar",
  intro_video_media_id: null,
  status: "draft",
  moderation_status: "pending",
  rating_avg: 0,
  rating_count: 0,
  version: 1,
  subjects: ["math"],
  grade_levels: [6, 7, 8, 9],
  teaching_modes: ["online", "offline"],
  offline_areas: [{ province_code: "HN", district_code: "CG" }],
};

function filledForm(overrides: Partial<ProfileFormState> = {}): ProfileFormState {
  return { ...profileToForm(serverProfile), ...overrides };
}

describe("profileToForm", () => {
  it("maps a server profile into editable string/array fields", () => {
    const form = profileToForm(serverProfile);
    expect(form.display_name).toBe("Cô Linh");
    expect(form.gender).toBe("female");
    expect(form.student_year).toBe("3");
    expect(form.expected_fee_min).toBe("180000");
    expect(form.grade_levels).toEqual([6, 7, 8, 9]);
    expect(form.offline_areas).toEqual([{ province_code: "HN", district_code: "CG" }]);
    expect(form.avatar_media_id).toBe("media-avatar");
  });

  it("normalizes an unknown gender to empty selection", () => {
    const form = profileToForm({ ...serverProfile, gender: "unknown" });
    expect(form.gender).toBe("");
  });
});

describe("formToPayload", () => {
  it("omits empty optionals but always sends normalized arrays", () => {
    const form = emptyProfileForm();
    form.display_name = "  Cô Linh  ";
    form.subjects = ["math", "math"];
    form.grade_levels = [6, 6, 7];
    const payload = formToPayload(form);
    expect(payload.display_name).toBe("Cô Linh");
    expect(payload).not.toHaveProperty("bio");
    expect(payload).not.toHaveProperty("gender");
    expect(payload).not.toHaveProperty("student_year");
    expect(payload.subjects).toEqual(["math"]);
    expect(payload.grade_levels).toEqual([6, 7]);
    expect(payload.offline_areas).toEqual([]);
  });

  it("sends offline areas only when the offline mode is selected", () => {
    const online = filledForm({ teaching_modes: ["online"] });
    expect(formToPayload(online).offline_areas).toEqual([]);

    const offline = filledForm({
      teaching_modes: ["offline"],
      offline_areas: [{ province_code: " HN ", district_code: "" }, { province_code: "", district_code: "x" }],
    });
    expect(formToPayload(offline).offline_areas).toEqual([{ province_code: "HN" }]);
  });

  it("parses numeric strings into integers/floats", () => {
    const payload = formToPayload(filledForm());
    expect(payload.expected_fee_min).toBe(180000);
    expect(payload.student_year).toBe(3);
    expect(payload.exam_score).toBe(27.5);
  });
});

describe("validateProfileForm", () => {
  it("requires a display name", () => {
    expect(validateProfileForm(emptyProfileForm()).display_name).toBeTruthy();
  });

  it("rejects fee min greater than max", () => {
    const form = filledForm({ expected_fee_min: "300000", expected_fee_max: "100000" });
    expect(validateProfileForm(form).expected_fee_max).toBeTruthy();
  });

  it("requires an offline area when offline mode is on", () => {
    const form = filledForm({ teaching_modes: ["offline"], offline_areas: [] });
    expect(validateProfileForm(form).offline_areas).toBeTruthy();
  });

  it("rejects out-of-range numeric fields", () => {
    const form = filledForm({ student_year: "9", exam_score: "40", gpa: "11" });
    const errors = validateProfileForm(form);
    expect(errors.student_year).toBeTruthy();
    expect(errors.exam_score).toBeTruthy();
    expect(errors.gpa).toBeTruthy();
  });

  it("passes a well-formed profile", () => {
    expect(validateProfileForm(filledForm())).toEqual({});
  });
});

describe("evaluateCompleteness", () => {
  it("marks a complete profile publishable", () => {
    const result = evaluateCompleteness(filledForm());
    expect(result.publishable).toBe(true);
    expect(result.done).toBe(result.total);
  });

  it("is not publishable when required searchable fields are missing", () => {
    const form = filledForm({ bio: "", subjects: [] });
    const result = evaluateCompleteness(form);
    expect(result.publishable).toBe(false);
    expect(result.items.find((item) => item.key === "bio")?.ok).toBe(false);
    expect(result.items.find((item) => item.key === "subjects")?.ok).toBe(false);
  });
});
