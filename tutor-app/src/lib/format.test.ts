import { describe, expect, it } from "vitest";
import { formatUtcForVietnam, formatVnd, toUtcIso } from "./format";

describe("format helpers", () => {
  it("formats VND without decimals", () => {
    expect(formatVnd(299_000)).toMatch(/299[.\s]000\s₫/);
    expect(formatVnd(null)).toBe("—");
  });

  it("renders UTC in Vietnam timezone", () => {
    expect(formatUtcForVietnam("2026-07-15T00:00:00.000Z")).toContain("07:00");
    expect(formatUtcForVietnam("invalid")).toBe("—");
  });

  it("serializes dates as UTC and rejects invalid dates", () => {
    expect(toUtcIso(new Date("2026-07-15T07:00:00+07:00"))).toBe("2026-07-15T00:00:00.000Z");
    expect(() => toUtcIso(new Date("invalid"))).toThrow(RangeError);
  });
});
