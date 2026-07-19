import type {
  TrialRequestSummary,
  TrialStatus,
} from "@kimthanh-tutor/contracts";

export const TRIAL_FILTERS: Array<{ value: "all" | TrialStatus; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "accepted", label: "Đã nhận" },
  { value: "declined", label: "Đã từ chối" },
  { value: "expired", label: "Hết hạn" },
  { value: "cancelled", label: "Đã hủy" },
];

export function trialStatusPresentation(status: TrialStatus) {
  const presentations = {
    pending: { label: "Chờ xử lý", tone: "warn" },
    accepted: { label: "Đã nhận", tone: "ok" },
    declined: { label: "Đã từ chối", tone: "mute" },
    expired: { label: "Hết hạn", tone: "danger" },
    cancelled: { label: "Phụ huynh đã hủy", tone: "mute" },
  } as const;
  return presentations[status];
}

export function activationPresentation(trial: TrialRequestSummary): string | null {
  const labels = {
    not_applicable: null,
    not_required: "Phụ huynh đã có tài khoản; không cần kích hoạt.",
    link_created: "Link kích hoạt đã được tạo; đang chờ phụ huynh hoàn tất.",
    activated: "Phụ huynh đã kích hoạt và liên kết lớp.",
    expired: "Link kích hoạt đã hết hạn.",
  } as const;
  return labels[trial.activation.state];
}

export function validateDeclineReason(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Vui lòng nhập lý do từ chối.";
  if (trimmed.length > 500) return "Lý do không được quá 500 ký tự.";
  return null;
}

export function conflictTrial(details: unknown): TrialRequestSummary | null {
  if (!details || typeof details !== "object") return null;
  const trial = (details as { trial?: unknown }).trial;
  if (!trial || typeof trial !== "object") return null;
  const candidate = trial as Partial<TrialRequestSummary>;
  return typeof candidate.id === "string" && typeof candidate.status === "string"
    ? candidate as TrialRequestSummary
    : null;
}
