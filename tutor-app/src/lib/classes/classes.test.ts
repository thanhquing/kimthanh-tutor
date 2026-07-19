import { describe, expect, it } from "vitest";
import type { ClassDetail } from "@kimthanh-tutor/contracts";
import {
  classStatusPresentation,
  conflictClass,
  groupClasses,
} from "./classes";

const item = (status: ClassDetail["status"]): ClassDetail => ({
  id: status, trial_request_id: null, parent_profile_id: null, student_id: null,
  tutor_profile_id: "tutor", subject: "math", status, version: 0,
  started_at: null, ended_at: null, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z", parent: null, student: null,
  requested_teaching_mode: null, requested_schedule: null,
  capabilities: { transitions: [], can_create_lesson_log: false, can_view_review: false },
});

describe("class presentation", () => {
  it("uses only canonical class states", () => {
    expect(classStatusPresentation("trial_accepted").label).toBe("Chờ bắt đầu");
    expect(classStatusPresentation("completed_pending_review").label).toBe("Chờ đánh giá");
  });

  it("groups ongoing and ended classes", () => {
    const grouped = groupClasses([item("active"), item("cancelled"), item("paused")]);
    expect(grouped.ongoing.map((value) => value.status)).toEqual(["active", "paused"]);
    expect(grouped.ended.map((value) => value.status)).toEqual(["cancelled"]);
  });

  it("extracts only usable conflict payloads", () => {
    expect(conflictClass({ class_contract: item("active") })?.status).toBe("active");
    expect(conflictClass({ class_contract: { id: "x" } })).toBeNull();
  });
});
