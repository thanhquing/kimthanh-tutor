const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function formatVnd(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : vnd.format(value);
}

export function formatUtcForVietnam(value: string | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
    ...options,
  }).format(date);
}

export function toUtcIso(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new RangeError("Ngày giờ không hợp lệ");
  return value.toISOString();
}
