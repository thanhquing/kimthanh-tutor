import { expect, type Page } from "@playwright/test";
import { E2E_TUTOR_EMAIL } from "../lib/seed";
import { readSecrets } from "../lib/secrets";

/**
 * Đăng nhập gia sư bằng email + password trên browser thật rồi để
 * `routeAfterAuth` điều hướng client-side tới `next`. Password đọc từ file bí
 * mật do global-setup sinh (không hardcode). Bước này chạm ranh giới ApiClient
 * (POST /auth/login) — bắt sớm lỗi kiểu binding fetch.
 *
 * LƯU Ý: token tutor là memory-only (chủ đích bảo mật). KHÔNG dùng page.goto tới
 * route bảo vệ SAU login (full reload xóa token → đá về /login); điều hướng
 * client-side (routeAfterAuth hoặc click NavLink).
 */
export async function loginViaPassword(page: Page, next = "/availability", email = E2E_TUTOR_EMAIL) {
  const { userPassword } = readSecrets();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);

  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Mật khẩu").fill(userPassword);

  const login = page.waitForResponse(
    (r) => r.url().includes("/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  expect((await login).ok()).toBeTruthy();

  await page.waitForURL((url) => url.pathname === next, { timeout: 15_000 });
}
