import { expect, test } from "@playwright/test";
import { loginViaPassword } from "./helpers";

// R-05 — phiên gia sư phải sống qua reload. Access token memory-only mất khi
// reload, nhưng cookie HttpOnly `kt_refresh` cho phép boot gọi /auth/refresh để
// khôi phục phiên thay vì đá về /login (UX cũ sai: reload = phải đăng nhập lại).
test("tutor-app: phiên sống qua reload nhờ cookie HttpOnly (R-05)", async ({ page }) => {
  await loginViaPassword(page, "/availability");

  // Full reload: RAM mất access token; kỳ vọng boot đổi cookie lấy token mới.
  const refresh = page.waitForResponse(
    (r) => r.url().includes("/auth/refresh") && r.request().method() === "POST",
  );
  await page.reload();
  expect((await refresh).ok()).toBeTruthy();

  await expect(page).toHaveURL((url) => url.pathname === "/availability");
  await expect(page.getByRole("heading", { name: "Lịch rảnh trong tuần" })).toBeVisible();

  // Điều hướng sâu bằng full navigation (không client-side) cũng giữ phiên.
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ gia sư" })).toBeVisible();
});

// Đăng xuất phải dọn cookie: sau logout, reload vào route bảo vệ bị đá về /login.
test("tutor-app: logout dọn cookie, reload route bảo vệ về /login", async ({ page }) => {
  await loginViaPassword(page, "/availability");

  const logout = page.waitForResponse(
    (r) => r.url().includes("/auth/logout") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await logout;

  await page.goto("/availability");
  await expect(page).toHaveURL((url) => url.pathname === "/login");
});
