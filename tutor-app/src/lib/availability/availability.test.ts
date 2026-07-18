import type { TutorAvailability } from "@kimthanh-tutor/contracts";
import { describe, expect, it } from "vitest";
import {
  buildWeekGrid,
  dayLabel,
  findOverlaps,
  slotHours,
  slotsOverlap,
  sortSlots,
  summarize,
  toMinutes,
  validateSlotInput,
  WEEK_DAYS,
} from "./availability";

function slot(partial: Partial<TutorAvailability>): TutorAvailability {
  return {
    id: partial.id ?? "s1",
    day_of_week: partial.day_of_week ?? 0,
    start_time: partial.start_time ?? "19:00",
    end_time: partial.end_time ?? "21:00",
    type: partial.type ?? "available",
    note: partial.note ?? null,
  };
}

describe("day mapping", () => {
  it("maps 0 to Thứ Hai and 6 to Chủ Nhật", () => {
    expect(dayLabel(0).short).toBe("T2");
    expect(dayLabel(0).long).toBe("Thứ Hai");
    expect(dayLabel(6).short).toBe("CN");
    expect(dayLabel(6).long).toBe("Chủ Nhật");
  });

  it("covers exactly 7 days starting Monday", () => {
    expect(WEEK_DAYS).toHaveLength(7);
    expect(WEEK_DAYS.map((d) => d.value)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("falls back safely for out-of-range day", () => {
    expect(dayLabel(9).short).toBe("?");
  });
});

describe("toMinutes", () => {
  it("parses valid HH:mm", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("19:30")).toBe(1170);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("rejects invalid times", () => {
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("19:60")).toBeNull();
    expect(toMinutes("7:00")).toBeNull();
    expect(toMinutes("abc")).toBeNull();
  });
});

describe("slotHours", () => {
  it("computes decimal hours", () => {
    expect(slotHours({ start_time: "19:00", end_time: "21:00" })).toBe(2);
    expect(slotHours({ start_time: "18:30", end_time: "20:00" })).toBe(1.5);
  });

  it("returns 0 for invalid or inverted ranges", () => {
    expect(slotHours({ start_time: "21:00", end_time: "19:00" })).toBe(0);
    expect(slotHours({ start_time: "bad", end_time: "20:00" })).toBe(0);
  });
});

describe("validateSlotInput", () => {
  const base = { day_of_week: 0, start_time: "19:00", end_time: "21:00", type: "available" as const };

  it("accepts a valid slot", () => {
    expect(validateSlotInput(base)).toEqual({});
  });

  it("rejects start >= end", () => {
    expect(validateSlotInput({ ...base, start_time: "21:00", end_time: "19:00" }).end_time).toMatch(/sau giờ bắt đầu/);
    expect(validateSlotInput({ ...base, start_time: "19:00", end_time: "19:00" }).end_time).toBeDefined();
  });

  it("rejects malformed time", () => {
    expect(validateSlotInput({ ...base, start_time: "7:0" }).start_time).toBeDefined();
  });

  it("rejects out-of-range day", () => {
    expect(validateSlotInput({ ...base, day_of_week: 7 }).day_of_week).toBeDefined();
    expect(validateSlotInput({ ...base, day_of_week: -1 }).day_of_week).toBeDefined();
  });

  it("rejects over-long note", () => {
    expect(validateSlotInput({ ...base, note: "x".repeat(201) }).note).toBeDefined();
  });
});

describe("slotsOverlap / findOverlaps", () => {
  it("detects overlap on same day", () => {
    expect(
      slotsOverlap(
        { day_of_week: 0, start_time: "19:00", end_time: "21:00" },
        { day_of_week: 0, start_time: "20:00", end_time: "22:00" },
      ),
    ).toBe(true);
  });

  it("treats touching edges as non-overlapping", () => {
    expect(
      slotsOverlap(
        { day_of_week: 0, start_time: "19:00", end_time: "21:00" },
        { day_of_week: 0, start_time: "21:00", end_time: "22:00" },
      ),
    ).toBe(false);
  });

  it("ignores different days", () => {
    expect(
      slotsOverlap(
        { day_of_week: 0, start_time: "19:00", end_time: "21:00" },
        { day_of_week: 1, start_time: "19:00", end_time: "21:00" },
      ),
    ).toBe(false);
  });

  it("excludes the candidate itself by id", () => {
    const existing = [slot({ id: "a", day_of_week: 0, start_time: "19:00", end_time: "21:00" })];
    expect(findOverlaps({ id: "a", day_of_week: 0, start_time: "19:00", end_time: "21:00" }, existing)).toHaveLength(0);
    expect(findOverlaps({ id: "b", day_of_week: 0, start_time: "19:00", end_time: "20:00" }, existing)).toHaveLength(1);
  });
});

describe("sortSlots", () => {
  it("orders by day then start time", () => {
    const sorted = sortSlots([
      slot({ id: "a", day_of_week: 2, start_time: "18:00", end_time: "20:00" }),
      slot({ id: "b", day_of_week: 0, start_time: "20:00", end_time: "21:00" }),
      slot({ id: "c", day_of_week: 0, start_time: "08:00", end_time: "09:00" }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});

describe("summarize", () => {
  it("splits available and busy hours", () => {
    const summary = summarize([
      slot({ id: "a", start_time: "19:00", end_time: "21:00", type: "available" }),
      slot({ id: "b", start_time: "09:00", end_time: "11:00", type: "busy" }),
    ]);
    expect(summary.slotCount).toBe(2);
    expect(summary.totalHours).toBe(4);
    expect(summary.availableHours).toBe(2);
    expect(summary.busyHours).toBe(2);
  });
});

describe("buildWeekGrid", () => {
  it("defaults to 06:00–22:00 when empty", () => {
    const grid = buildWeekGrid([]);
    expect(grid.hours[0]).toBe(6);
    expect(grid.hours[grid.hours.length - 1]).toBe(21);
    expect(grid.rows[0]).toHaveLength(7);
    expect(grid.rows.every((row) => row.every((cell) => cell.slot === null))).toBe(true);
  });

  it("marks covered cells with the right day and slot, including early/late edges", () => {
    const early = slot({ id: "early", day_of_week: 0, start_time: "05:00", end_time: "06:30" });
    const late = slot({ id: "late", day_of_week: 6, start_time: "22:00", end_time: "23:00" });
    const grid = buildWeekGrid([early, late]);
    expect(grid.hours[0]).toBe(5);
    expect(grid.hours[grid.hours.length - 1]).toBe(22);
    // Monday (col 0) at 05:00 covered by "early".
    const row5 = grid.rows.find((row) => row[0].hour === 5)!;
    expect(row5[0].slot?.id).toBe("early");
    // Sunday (col 6) at 22:00 covered by "late".
    const row22 = grid.rows.find((row) => row[0].hour === 22)!;
    expect(row22[6].slot?.id).toBe("late");
    // Same Sunday 22:00 on Monday col stays empty.
    expect(row22[0].slot).toBeNull();
  });
});
