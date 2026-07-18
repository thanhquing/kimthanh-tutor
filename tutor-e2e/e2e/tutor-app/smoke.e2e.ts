import { expect, test } from "@playwright/test";
import { loginViaPassword } from "./helpers";

// Smoke tutor-app: một phiên đăng nhập email+password bao phủ TA-02 (hồ sơ) và
// TA-03 (lịch), điều hướng giữa màn bằng client-side nav (token memory-only nên
// không reload).
test("tutor-app: hồ sơ (TA-02) và lịch rảnh (TA-03) trên browser thật", async ({ page }) => {
  await loginViaPassword(page, "/availability");

  // --- TA-03: lịch rảnh — thêm rồi xóa khung giờ (POST 201 / DELETE 200) ---
  await expect(page.getByRole("heading", { name: "Lịch rảnh trong tuần" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Danh sách khung giờ" })).toBeVisible();

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

  const del = page.waitForResponse(
    (r) => r.url().includes("/tutors/me/availabilities/") && r.request().method() === "DELETE",
  );
  await row.getByRole("button", { name: "Xóa" }).click();
  expect((await del).status()).toBe(200);
  await expect(row).toHaveCount(0);

  // --- TA-02: hồ sơ — điều hướng client-side (không reload) và kiểm dữ liệu thật ---
  await page.getByRole("link", { name: "Hồ sơ gia sư" }).click();
  await page.waitForURL((url) => url.pathname === "/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ gia sư" })).toBeVisible();
  await expect(page.getByLabel(/Tên hiển thị/)).toHaveValue("Cô E2E");
});
