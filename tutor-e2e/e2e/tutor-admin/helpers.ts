import { expect, type Page } from "@playwright/test";
import { ADMIN_EMAIL } from "../lib/seed";
import { readSecrets } from "../lib/secrets";

/**
 * Đăng nhập admin bằng email/password trên browser thật. Password đọc từ file
 * bí mật do global-setup sinh (không hardcode). Bước này chạm ranh giới
 * ApiClient (POST /auth/admin/password).
 *
 * Admin không có route `/login`: AuthGate render LoginPage khi chưa có `me` tại
 * bất kỳ URL nào, nên vào `/` để sau login `Navigate` đưa tới /overview.
 */
export async function adminLogin(page: Page) {
  const { adminPassword } = readSecrets();
  await page.goto("/");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Mật khẩu").fill(adminPassword);

  const login = page.waitForResponse(
    (r) => r.url().includes("/auth/admin/password") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  expect((await login).ok()).toBeTruthy();

  await page.waitForURL((url) => url.pathname.startsWith("/overview"), { timeout: 15_000 });
}
