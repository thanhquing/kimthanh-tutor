import type { AvailabilityType, TutorAvailability } from "@kimthanh-tutor/contracts";

/**
 * Quy ước ngày trong tuần: 0 = Thứ Hai … 5 = Thứ Bảy, 6 = Chủ Nhật (tuần bắt
 * đầu Thứ Hai theo lịch VN). KHÔNG dùng `Date.getDay()` (Chủ Nhật = 0) làm giá
 * trị lưu — xem `ai-docs/05-domain-model.md` §TutorAvailability.
 */
export interface DayLabel {
  value: number;
  short: string;
  long: string;
}

export const WEEK_DAYS: DayLabel[] = [
  { value: 0, short: "T2", long: "Thứ Hai" },
  { value: 1, short: "T3", long: "Thứ Ba" },
  { value: 2, short: "T4", long: "Thứ Tư" },
  { value: 3, short: "T5", long: "Thứ Năm" },
  { value: 4, short: "T6", long: "Thứ Sáu" },
  { value: 5, short: "T7", long: "Thứ Bảy" },
  { value: 6, short: "CN", long: "Chủ Nhật" },
];

export function dayLabel(dayOfWeek: number): DayLabel {
  return WEEK_DAYS[dayOfWeek] ?? { value: dayOfWeek, short: "?", long: "Không rõ" };
}

export const AVAILABILITY_TYPES: Array<{ value: AvailabilityType; label: string; hint: string }> = [
  { value: "available", label: "Rảnh (nhận dạy)", hint: "Khung giờ bạn có thể nhận lớp." },
  { value: "busy", label: "Bận", hint: "Lịch học ở trường, lớp đang dạy… — không nhận thêm." },
];

export function availabilityTypeLabel(type: AvailabilityType): string {
  return AVAILABILITY_TYPES.find((item) => item.value === type)?.label ?? type;
}

/** Chuyển `HH:mm` sang tổng số phút trong ngày; trả `null` nếu sai định dạng. */
export function toMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Số giờ (thập phân) của một slot, dùng để tổng hợp "giờ/tuần". */
export function slotHours(slot: Pick<TutorAvailability, "start_time" | "end_time">): number {
  const start = toMinutes(slot.start_time);
  const end = toMinutes(slot.end_time);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
}

export interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: AvailabilityType;
  note?: string;
}

export interface SlotInputErrors {
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  note?: string;
}

/** Validate client-side, phản chiếu ràng buộc server (`start < end`, HH:mm, ngày 0..6). */
export function validateSlotInput(input: SlotInput): SlotInputErrors {
  const errors: SlotInputErrors = {};
  if (!Number.isInteger(input.day_of_week) || input.day_of_week < 0 || input.day_of_week > 6) {
    errors.day_of_week = "Chọn thứ hợp lệ trong tuần.";
  }
  const start = toMinutes(input.start_time);
  const end = toMinutes(input.end_time);
  if (start === null) errors.start_time = "Giờ bắt đầu không hợp lệ (HH:mm).";
  if (end === null) errors.end_time = "Giờ kết thúc không hợp lệ (HH:mm).";
  if (start !== null && end !== null && start >= end) {
    errors.end_time = "Giờ kết thúc phải sau giờ bắt đầu.";
  }
  if (input.note && input.note.length > 200) {
    errors.note = "Ghi chú tối đa 200 ký tự.";
  }
  return errors;
}

export function hasErrors(errors: SlotInputErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Hai slot chồng giờ khi cùng ngày và khoảng `[start,end)` giao nhau. */
export function slotsOverlap(
  a: Pick<TutorAvailability, "day_of_week" | "start_time" | "end_time">,
  b: Pick<TutorAvailability, "day_of_week" | "start_time" | "end_time">,
): boolean {
  if (a.day_of_week !== b.day_of_week) return false;
  const aStart = toMinutes(a.start_time);
  const aEnd = toMinutes(a.end_time);
  const bStart = toMinutes(b.start_time);
  const bEnd = toMinutes(b.end_time);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** Các slot hiện có chồng lấn với `candidate` (bỏ qua chính nó theo `id`). */
export function findOverlaps(
  candidate: Pick<TutorAvailability, "day_of_week" | "start_time" | "end_time"> & { id?: string },
  existing: TutorAvailability[],
): TutorAvailability[] {
  return existing.filter(
    (slot) => slot.id !== candidate.id && slotsOverlap(candidate, slot),
  );
}

/** Sắp xếp slot theo ngày rồi giờ bắt đầu để hiển thị danh sách ổn định. */
export function sortSlots(slots: TutorAvailability[]): TutorAvailability[] {
  return [...slots].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0);
  });
}

export interface WeekSummary {
  slotCount: number;
  totalHours: number;
  availableHours: number;
  busyHours: number;
}

export function summarize(slots: TutorAvailability[]): WeekSummary {
  return slots.reduce<WeekSummary>(
    (acc, slot) => {
      const hours = slotHours(slot);
      acc.slotCount += 1;
      acc.totalHours += hours;
      if (slot.type === "busy") acc.busyHours += hours;
      else acc.availableHours += hours;
      return acc;
    },
    { slotCount: 0, totalHours: 0, availableHours: 0, busyHours: 0 },
  );
}

export interface GridCell {
  day: number;
  hour: number;
  slot: TutorAvailability | null;
}

export interface WeekGrid {
  hours: number[];
  rows: GridCell[][];
}

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

/**
 * Dựng bảng tuần: hàng là các mốc giờ nguyên, cột là 7 ngày. Một ô "được phủ"
 * nếu có slot cùng ngày giao với khoảng `[hour, hour+1)`. Khoảng giờ tự co giãn
 * theo slot thực tế nhưng luôn phủ tối thiểu 06:00–22:00 để bảng không trống.
 */
export function buildWeekGrid(slots: TutorAvailability[]): WeekGrid {
  let minHour = DEFAULT_START_HOUR;
  let maxHour = DEFAULT_END_HOUR;
  for (const slot of slots) {
    const start = toMinutes(slot.start_time);
    const end = toMinutes(slot.end_time);
    if (start !== null) minHour = Math.min(minHour, Math.floor(start / 60));
    if (end !== null) maxHour = Math.max(maxHour, Math.ceil(end / 60));
  }
  const hours: number[] = [];
  for (let h = minHour; h < maxHour; h += 1) hours.push(h);

  const rows = hours.map((hour) => {
    const cellStart = hour * 60;
    const cellEnd = cellStart + 60;
    return WEEK_DAYS.map<GridCell>((day) => {
      const slot =
        slots.find((candidate) => {
          if (candidate.day_of_week !== day.value) return false;
          const start = toMinutes(candidate.start_time);
          const end = toMinutes(candidate.end_time);
          if (start === null || end === null) return false;
          return start < cellEnd && cellStart < end;
        }) ?? null;
      return { day: day.value, hour, slot };
    });
  });

  return { hours, rows };
}
