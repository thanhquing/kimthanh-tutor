export function formatVnd(value: number | null): string {
  if (value === null) return "Liên hệ để trao đổi";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export function formatVietnamTime(iso: string | null): string {
  if (!iso) return "Chưa cập nhật";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
