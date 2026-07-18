import { expect, test } from "@playwright/test";
import { loginViaOtp } from "./helpers";

// TA-02 — smoke browser thật: đăng nhập → /profile tải hồ sơ đã seed qua API thật.
test("TA-02: hồ sơ gia sư tải được trên browser thật", async ({ page }) => {
  // Sau login, `routeAfterAuth` điều hướng client-side tới /profile và
  // ProfilePage tự gọi GET /tutors/me/profile thật (không reload).
  await loginViaOtp(page, "/profile");

  await expect(page.getByRole("heading", { name: "Hồ sơ gia sư" })).toBeVisible();
  await expect(page.getByLabel(/Tên hiển thị/)).toHaveValue("Cô E2E");
});
