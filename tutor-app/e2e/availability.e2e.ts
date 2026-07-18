import { expect, test } from "@playwright/test";
import { loginViaOtp } from "./helpers";

// TA-03 — smoke browser thật: đăng nhập → /availability → thêm + xóa khung giờ,
// khẳng định POST/DELETE /availabilities thật trả 2xx (không phải NETWORK_ERROR).
test("TA-03: thêm và xóa khung giờ trên browser thật", async ({ page }) => {
  await loginViaOtp(page, "/availability");

  await expect(page.getByRole("heading", { name: "Lịch rảnh trong tuần" })).toBeVisible();
  // List đã tải xong (kể cả khi rỗng) — chứng tỏ GET /availabilities chạy thật.
  await expect(page.getByRole("heading", { name: "Danh sách khung giờ" })).toBeVisible();

  // Thêm khung giờ Thứ Sáu 07:00–08:00 (ít khả năng trùng).
  await page.getByRole("button", { name: "+ Thêm khung giờ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Thứ").selectOption("4");
  await dialog.getByLabel("Bắt đầu").fill("07:00");
  await dialog.getByLabel("Kết thúc").fill("08:00");

  const create = page.waitForResponse(
    (r) => r.url().includes("/tutors/me/availabilities") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu khung giờ" }).click();
  expect((await create).status()).toBe(201);

  const row = page.locator(".avail-row", { hasText: "Thứ Sáu · 07:00–08:00" });
  await expect(row).toBeVisible();

  // Xóa lại để test hermetic.
  const del = page.waitForResponse(
    (r) => r.url().includes("/tutors/me/availabilities/") && r.request().method() === "DELETE",
  );
  await row.getByRole("button", { name: "Xóa" }).click();
  expect((await del).status()).toBe(200);
  await expect(row).toHaveCount(0);
});
