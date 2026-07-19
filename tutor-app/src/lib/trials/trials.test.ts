import { describe, expect, it } from "vitest";
import type { TrialRequestSummary } from "@kimthanh-tutor/contracts";
import {
  activationPresentation,
  conflictTrial,
  trialStatusPresentation,
  validateDeclineReason,
} from "./trials";

const accepted = {
  id: "trial-1",
  status: "accepted",
  activation: { state: "link_created", expires_at: null },
} as TrialRequestSummary;

describe("trial presenter", () => {
  it("maps every terminal state without inventing actions", () => {
    expect(trialStatusPresentation("cancelled")).toEqual({ label: "Phụ huynh đã hủy", tone: "mute" });
    expect(trialStatusPresentation("expired").tone).toBe("danger");
  });

  it("describes activation delivery as created, not delivered", () => {
    expect(activationPresentation(accepted)).toContain("đã được tạo");
    expect(activationPresentation(accepted)).not.toContain("đã gửi");
  });

  it("trims and validates decline reason", () => {
    expect(validateDeclineReason("   ")).toBe("Vui lòng nhập lý do từ chối.");
    expect(validateDeclineReason(" Không phù hợp lịch ")).toBeNull();
    expect(validateDeclineReason("x".repeat(501))).toContain("500");
  });

  it("extracts only a conflict payload containing a trial", () => {
    expect(conflictTrial({ trial: accepted })).toBe(accepted);
    expect(conflictTrial({ current: accepted })).toBeNull();
  });
});
