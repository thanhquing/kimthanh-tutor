import { expect, test } from "@playwright/test";
import { E2E_PARENT_EMAIL } from "../lib/seed";
import { readSecrets } from "../lib/secrets";

// TM-03 — phụ huynh đăng nhập email+password trên browser thật (qua Next rewrite
// /api → API) rồi vào khu vực tài khoản riêng tư (guard client cho qua vì đã
// verify + consent). Chạm ranh giới ApiClient client-side (POST /auth/login).
test("TM-03: phụ huynh đăng nhập email+password → khu vực tài khoản", async ({ page }) => {
  const { userPassword } = readSecrets();
  await page.goto("/login");

  await page.getByRole("textbox", { name: "Email" }).fill(E2E_PARENT_EMAIL);
  await page.getByLabel("Mật khẩu").fill(userPassword);

  const login = page.waitForResponse(
    (r) => r.url().includes("/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  expect((await login).ok()).toBeTruthy();

  await page.waitForURL((url) => url.pathname === "/account", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Tài khoản phụ huynh" })).toBeVisible();
});
