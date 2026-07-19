import { expect, test } from "@playwright/test";

// Google OAuth server-side — nút "Tiếp tục với Google" phải khởi động luồng code:
// FE → /auth/oauth/google/start → 302 sang Google kèm client_id + redirect_uri.
// Không verify đăng nhập Google thật (cần tài khoản người dùng thật), nhưng xác
// nhận toàn chuỗi FE→BE→Google đúng trên browser thật.
// Gate sau E2E_OAUTH vì cần API cấu hình Google creds + có internet tới Google.
test("tutor-app: nút Google redirect sang Google OAuth với client_id", async ({ page }) => {
  test.skip(!process.env.E2E_OAUTH, "Đặt E2E_OAUTH=1 khi API đã có Google creds + internet");

  await page.goto("/login");
  await page.getByRole("link", { name: "Tiếp tục với Google" }).click();

  await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 });
  const url = new URL(page.url());
  expect(url.hostname).toContain("accounts.google.com");
  expect(url.searchParams.get("client_id")).toMatch(/\.apps\.googleusercontent\.com$/);
  expect(url.searchParams.get("redirect_uri")).toContain("/auth/oauth/google/callback");
  expect(url.searchParams.get("scope")).toContain("email");
});
