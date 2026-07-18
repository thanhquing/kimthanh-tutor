import { expect, test } from "@playwright/test";

// TM-00 — trang chủ (search SSR public) render với dữ liệu từ API thật
// (server-side fetch /tutors/search). Khách chưa đăng nhập vẫn tìm gia sư được.
test("TM-00: trang chủ search public render từ API thật", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Tìm gia sư phù hợp cho con/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gia sư mới cập nhật" })).toBeVisible();
});
