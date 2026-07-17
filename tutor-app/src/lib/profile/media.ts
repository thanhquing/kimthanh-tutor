import type { ModerationStatus, ScanStatus } from "@kimthanh-tutor/contracts";

export type UploadKind = "avatar" | "intro_video";

// Mirror của MediaService phía server (giữ đồng bộ khi server đổi giới hạn).
export const MEDIA_RULES: Record<UploadKind, { maxBytes: number; mimePattern: RegExp; accept: string; hint: string }> = {
  avatar: {
    maxBytes: 5 * 1024 * 1024,
    mimePattern: /^image\/(png|jpe?g|webp)$/,
    accept: "image/png,image/jpeg,image/webp",
    hint: "PNG, JPG hoặc WEBP, tối đa 5MB.",
  },
  intro_video: {
    maxBytes: 100 * 1024 * 1024,
    mimePattern: /^video\/(mp4|webm|quicktime)$/,
    accept: "video/mp4,video/webm,video/quicktime",
    hint: "MP4, WEBM hoặc MOV, tối đa 100MB.",
  },
};

export function validateMediaFile(
  kind: UploadKind,
  file: { type: string; size: number },
): string | null {
  const rule = MEDIA_RULES[kind];
  if (!rule.mimePattern.test(file.type)) {
    return `Định dạng không hợp lệ. ${rule.hint}`;
  }
  if (file.size <= 0 || file.size > rule.maxBytes) {
    return `Kích thước tệp vượt giới hạn. ${rule.hint}`;
  }
  return null;
}

/** Nhãn tiếng Việt cho trạng thái quét/kiểm duyệt media để hiển thị. */
export function mediaStateLabel(
  scan: ScanStatus,
  moderation: ModerationStatus,
): { tone: "pending" | "ok" | "warn" | "danger"; text: string } {
  if (scan === "infected") {
    return { tone: "danger", text: "Tệp bị phát hiện không an toàn, vui lòng tải lại tệp khác." };
  }
  if (moderation === "rejected") {
    return { tone: "danger", text: "Bị từ chối kiểm duyệt. Hãy tải nội dung phù hợp hơn." };
  }
  if (scan === "pending") {
    return { tone: "pending", text: "Đang quét an toàn tệp…" };
  }
  if (moderation === "pending") {
    return { tone: "warn", text: "Đã quét sạch, đang chờ kiểm duyệt hiển thị công khai." };
  }
  return { tone: "ok", text: "Đã duyệt và hiển thị công khai." };
}
