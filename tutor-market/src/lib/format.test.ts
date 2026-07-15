import { describe, expect, it } from "vitest";
import { formatVietnamTime } from "./format";

describe("formatVietnamTime", () => {
  it("hiển thị thời gian theo múi giờ Việt Nam", () => {
    expect(formatVietnamTime("2025-01-01T00:00:00.000Z")).toContain("07:00");
  });

  it("trả về fallback với ISO không hợp lệ", () => {
    expect(formatVietnamTime("not-a-date")).toBe("Chưa cập nhật");
  });
});
