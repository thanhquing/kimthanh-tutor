import type {
  ClassDetail,
  ClassStatus,
  ClassTransitionTarget,
} from "@kimthanh-tutor/contracts";

const STATUS: Record<ClassStatus, { label: string; tone: string; group: "ongoing" | "ended" }> = {
  trial_accepted: { label: "Chờ bắt đầu", tone: "warn", group: "ongoing" },
  active: { label: "Đang học", tone: "ok", group: "ongoing" },
  paused: { label: "Tạm dừng", tone: "mute", group: "ongoing" },
  completed_pending_review: { label: "Chờ đánh giá", tone: "pending", group: "ended" },
  completed: { label: "Đã hoàn tất", tone: "ok", group: "ended" },
  cancelled: { label: "Đã hủy", tone: "danger", group: "ended" },
};

const TRANSITION: Record<ClassTransitionTarget, { label: string; confirmation: string | null; tone: string }> = {
  active: { label: "Bắt đầu / tiếp tục", confirmation: null, tone: "primary" },
  paused: { label: "Tạm dừng lớp", confirmation: "Tạm dừng", tone: "secondary" },
  completed_pending_review: { label: "Kết thúc lớp", confirmation: "Kết thúc", tone: "primary" },
  cancelled: { label: "Hủy lớp", confirmation: "Hủy lớp", tone: "danger" },
};

export function classStatusPresentation(status: ClassStatus) {
  return STATUS[status];
}

export function classTransitionPresentation(target: ClassTransitionTarget) {
  return TRANSITION[target];
}

export function groupClasses(items: ClassDetail[]) {
  return {
    ongoing: items.filter((item) => STATUS[item.status].group === "ongoing"),
    ended: items.filter((item) => STATUS[item.status].group === "ended"),
  };
}

export function conflictClass(details: unknown): ClassDetail | null {
  if (!details || typeof details !== "object") return null;
  const value = (details as { class_contract?: unknown }).class_contract;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ClassDetail>;
  return typeof candidate.id === "string" && typeof candidate.status === "string" &&
    typeof candidate.version === "number" ? candidate as ClassDetail : null;
}
