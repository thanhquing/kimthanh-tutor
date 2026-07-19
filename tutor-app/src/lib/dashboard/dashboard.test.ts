import type { TutorDashboardOverview } from "@kimthanh-tutor/contracts";
import { describe, expect, it } from "vitest";
import {
  profileStatusPresentation,
  qrSubscriptionPresentation,
  sectionFailed,
} from "./dashboard";

function overview(): TutorDashboardOverview {
  return {
    profile: {
      id: "tutor-1",
      display_name: "Cô Linh",
      status: "published",
      moderation_status: "approved",
    },
    summary: { pending_trials: 0, teaching_classes: 0, pending_qr_records: 0 },
    pending_trials: [],
    teaching_classes: [],
    pending_qr_records: [],
    qr_subscription: null,
    capabilities: {
      has_payout_account: false,
      has_active_qr_access: false,
      can_create_qr: false,
    },
    partial_errors: [],
  };
}

describe("tutor dashboard presenter", () => {
  it("maps every profile state to explicit user-facing copy", () => {
    expect(profileStatusPresentation("draft")).toMatchObject({ label: "Bản nháp", tone: "warn" });
    expect(profileStatusPresentation("published")).toMatchObject({ label: "Đã đăng", tone: "ok" });
    expect(profileStatusPresentation("suspended")).toMatchObject({ label: "Tạm khóa", tone: "danger" });
  });

  it("does not claim QR access without entitlement", () => {
    expect(qrSubscriptionPresentation(overview()).label).toBe("Chưa kích hoạt");
  });

  it("uses server capability for admin overrides", () => {
    const data = overview();
    data.capabilities.has_active_qr_access = true;
    expect(qrSubscriptionPresentation(data).label).toBe("Đang hoạt động");
  });

  it("presents an existing inactive subscription truthfully", () => {
    const data = overview();
    data.qr_subscription = {
      id: "sub-1",
      type: "tutor_qr",
      scope_ref_id: null,
      payment_id: "payment-1",
      status: "expired",
      auto_renew: false,
      starts_at: null,
      current_period_end: null,
      cancelled_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    expect(qrSubscriptionPresentation(data)).toMatchObject({ label: "Đã hết hạn", tone: "mute" });
  });

  it("checks partial failures by stable section id", () => {
    const data = overview();
    data.partial_errors = ["pending_trials"];
    expect(sectionFailed(data, "pending_trials")).toBe(true);
    expect(sectionFailed(data, "teaching_classes")).toBe(false);
  });
});
