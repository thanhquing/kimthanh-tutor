import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

// AD-00 — đăng nhập admin (email/password) → shell + route /overview bảo vệ bằng
// phiên/role render đúng.
test("AD-00: đăng nhập admin và mở console vận hành", async ({ page }) => {
  await adminLogin(page);

  await expect(page.getByRole("heading", { name: "Tổng quan", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Người dùng" })).toBeVisible();
});
