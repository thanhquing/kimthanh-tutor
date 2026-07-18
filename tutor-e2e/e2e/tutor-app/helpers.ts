import { expect, type Page } from "@playwright/test";
import { E2E_TUTOR_PHONE } from "../lib/seed";

/**
 * Đăng nhập gia sư qua OTP dev trên browser thật rồi để `routeAfterAuth` điều
 * hướng client-side tới `next`. Mã OTP đọc từ response `/auth/otp/request`
 * (không hardcode). Đây là bước chạm ranh giới ApiClient — bắt sớm lỗi kiểu
 * binding fetch (Illegal invocation) từng lọt qua unit test.
 *
 * LƯU Ý: token tutor là memory-only (chủ đích bảo mật). KHÔNG dùng page.goto tới
 * route bảo vệ SAU login (full reload xóa token → đá về /login); điều hướng
 * client-side (routeAfterAuth hoặc click NavLink).
 */
export async function loginViaOtp(page: Page, next = "/availability", phone = E2E_TUTOR_PHONE) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);

  await page.getByLabel(/Số điện thoại/).fill(phone);
  const otpRequest = page.waitForResponse(
    (r) => r.url().includes("/auth/otp/request") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  const otpResponse = await otpRequest;
  expect(otpResponse.status()).toBe(201);
  const devCode = String((await otpResponse.json()).dev_code);

  await page.getByLabel("Mã OTP").fill(devCode);
  const verify = page.waitForResponse(
    (r) => r.url().includes("/auth/otp/verify") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  expect((await verify).status()).toBe(201);

  await page.waitForURL((url) => url.pathname === next, { timeout: 15_000 });
}
