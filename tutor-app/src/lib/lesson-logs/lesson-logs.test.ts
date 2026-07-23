import { describe, expect, it } from "vitest";
import type { LessonLogDetail } from "@kimthanh-tutor/contracts";
import {
  emptyLessonLogForm,
  fromDatetimeLocal,
  inputFromForm,
  mergeLessonPages,
  toDatetimeLocal,
  updateInputFromForm,
  validateLessonLog,
} from "./lesson-logs";

const log = (id: string): LessonLogDetail => ({
  id, class_contract_id: "class-1", tutor_profile_id: "tutor-1",
  lesson_at: "2026-07-19T12:30:00.000Z", subject: "Toán", content: null,
  homework: null, absorption_level: "normal", tutor_note: null,
  created_at: "2026-07-19T12:30:00.000Z", updated_at: "2026-07-19T12:30:00.000Z",
  capabilities: { can_edit: true, edit_until: "2026-07-26T12:30:00.000Z" },
});

describe("lesson log mapper", () => {
  it("round-trips UTC through a timezone-safe datetime-local value", () => {
    const iso = "2026-07-19T12:30:00.000Z";
    expect(fromDatetimeLocal(toDatetimeLocal(iso))).toBe(iso);
  });

  it("validates required and bounded fields", () => {
    const values = emptyLessonLogForm(new Date("2026-07-19T12:30:00.000Z"));
    expect(validateLessonLog({ ...values, subject: "   " }).subject).toBeTruthy();
    expect(validateLessonLog({ ...values, subject: "Toán", content: "x".repeat(4001) }).content).toBeTruthy();
  });

  it("trims input and uses canonical absorption enum", () => {
    const values = { ...emptyLessonLogForm(new Date("2026-07-19T12:30:00.000Z")), subject: " Toán ", content: " Đại số ", absorptionLevel: "needs_review" as const };
    expect(inputFromForm(values)).toMatchObject({ subject: "Toán", content: "Đại số", absorption_level: "needs_review" });
  });

  it("keeps empty optional fields in update input so existing values can be cleared", () => {
    const values = { ...emptyLessonLogForm(new Date("2026-07-19T12:30:00.000Z")), subject: " Toán ", content: "  ", tutorNote: "" };
    expect(updateInputFromForm(values)).toMatchObject({ subject: "Toán", content: "", tutor_note: "" });
  });

  it("deduplicates items across keyset pages and keeps server ordering", () => {
    const older = { ...log("1"), lesson_at: "2026-07-18T12:30:00.000Z" };
    const newer = { ...log("2"), lesson_at: "2026-07-20T12:30:00.000Z" };
    const tieBreaker = { ...log("3"), lesson_at: newer.lesson_at };
    expect(mergeLessonPages([{ items: [older], next_cursor: "c" }, { items: [older, newer, tieBreaker], next_cursor: null }]).map((item) => item.id)).toEqual(["3", "2", "1"]);
  });
});
