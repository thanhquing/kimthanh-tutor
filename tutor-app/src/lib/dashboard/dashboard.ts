import type {
  SubscriptionStatus,
  TutorDashboardOverview,
  TutorDashboardSection,
  TutorProfileStatus,
} from "@kimthanh-tutor/contracts";

export interface StatusPresentation {
  label: string;
  hint: string;
  tone: "ok" | "warn" | "danger" | "mute" | "pending";
}

const PROFILE_STATUS: Record<TutorProfileStatus, StatusPresentation> = {
  draft: { label: "Bản nháp", hint: "Hoàn thiện hồ sơ để bắt đầu nhận yêu cầu.", tone: "warn" },
  publishable: { label: "Sẵn sàng đăng", hint: "Hồ sơ đã đủ thông tin để xuất hiện trên chợ.", tone: "pending" },
  published: { label: "Đã đăng", hint: "Hồ sơ đang hiển thị công khai trên chợ.", tone: "ok" },
  hidden: { label: "Đang ẩn", hint: "Hồ sơ hiện không xuất hiện trên chợ.", tone: "mute" },
  suspended: { label: "Tạm khóa", hint: "Liên hệ hỗ trợ để biết thêm chi tiết.", tone: "danger" },
};

const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, StatusPresentation> = {
  pending_payment: { label: "Chờ thanh toán", hint: "Gói chưa được kích hoạt.", tone: "warn" },
  active: { label: "Đang hoạt động", hint: "Có thể dùng tính năng QR học phí.", tone: "ok" },
  past_due: { label: "Cần gia hạn", hint: "Gói đang quá hạn thanh toán.", tone: "warn" },
  expired: { label: "Đã hết hạn", hint: "Gia hạn để tiếp tục tạo QR học phí.", tone: "mute" },
  cancelled: { label: "Đã hủy", hint: "Gói không còn tự động gia hạn.", tone: "mute" },
  refunded: { label: "Đã hoàn tiền", hint: "Quyền dùng gói đã được thu hồi.", tone: "mute" },
};

export function profileStatusPresentation(status: TutorProfileStatus): StatusPresentation {
  return PROFILE_STATUS[status];
}

export function qrSubscriptionPresentation(
  overview: TutorDashboardOverview,
): StatusPresentation {
  if (overview.capabilities.has_active_qr_access) {
    return { label: "Đang hoạt động", hint: "Có thể dùng tính năng QR học phí.", tone: "ok" };
  }
  if (!overview.qr_subscription) {
    return { label: "Chưa kích hoạt", hint: "Đăng ký gói để tạo QR học phí.", tone: "mute" };
  }
  return SUBSCRIPTION_STATUS[overview.qr_subscription.status];
}

export function sectionFailed(
  overview: TutorDashboardOverview,
  section: TutorDashboardSection,
): boolean {
  return overview.partial_errors.includes(section);
}
