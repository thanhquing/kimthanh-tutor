import { expect, type Page } from "@playwright/test";
import { DEV_OTP, E2E_TUTOR_PHONE } from "./seed";

/**
 * Đăng nhập qua OTP dev trên browser thật rồi để `routeAfterAuth` điều hướng
 * client-side tới `next`. Đây là bước "chạm ranh giới": nếu ApiClient gọi
 * `fetch` sai binding, request OTP ném NETWORK_ERROR và bước này fail ngay —
 * đúng loại bug từng lọt qua unit test.
 *
 * LƯU Ý harness: token là memory-only (chủ đích bảo mật). KHÔNG dùng
 * `page.goto()` tới route bảo vệ SAU khi login — full reload xóa token và đá về
 * /login. Luôn điều hướng bằng client-side (click NavLink) trong test.
 */
export async function loginViaOtp(page: Page, next = "/availability", phone = E2E_TUTOR_PHONE) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);

  await page.getByLabel(/Số điện thoại/).fill(phone);
  const otpRequest = page.waitForResponse((r) => r.url().includes("/auth/otp/request") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  expect((await otpRequest).status()).toBe(201);

  await page.getByLabel("Mã OTP").fill(DEV_OTP);
  const verify = page.waitForResponse((r) => r.url().includes("/auth/otp/verify") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  expect((await verify).status()).toBe(201);

  await page.waitForURL((url) => url.pathname === next, { timeout: 15_000 });
}
