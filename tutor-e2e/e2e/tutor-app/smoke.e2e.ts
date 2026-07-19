import { expect, test } from "@playwright/test";
import { loginViaPassword } from "./helpers";
import { E2E_TRIAL_SUBJECT } from "../lib/seed";

// Smoke tutor-app: một phiên đăng nhập email+password bao phủ TA-02 (hồ sơ),
// TA-03 (lịch), TA-04 (dashboard), TA-05 (trial), điều hướng trong cùng phiên.
test("tutor-app: dashboard, trial inbox, hồ sơ và lịch rảnh trên browser thật", async ({ page }) => {
  await page.addInitScript(() => {
    const measuredWindow = window as typeof window & { __ktCls?: number };
    measuredWindow.__ktCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) measuredWindow.__ktCls = (measuredWindow.__ktCls ?? 0) + shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const dashboard = page.waitForResponse(
    (r) => r.url().includes("/dashboard/tutor/overview") && r.request().method() === "GET",
  );
  await loginViaPassword(page, "/dashboard");

  // --- TA-04: aggregate owner-safe đọc qua API thật ---
  expect((await dashboard).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Chào E2E/ })).toBeVisible();
  await expect(page.locator(".dashboard-stat", { hasText: "Hồ sơ" })).toBeVisible();

  // Reload sâu đo skeleton → nội dung thật, đồng thời chứng minh session cookie
  // khôi phục được query. Dashboard private đặt budget CLS < 0.1.
  const dashboardReload = page.waitForResponse(
    (r) => r.url().includes("/dashboard/tutor/overview") && r.request().method() === "GET",
  );
  await page.reload();
  expect((await dashboardReload).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Chào E2E/ })).toBeVisible();
  const cls = await page.evaluate(() => (window as typeof window & { __ktCls?: number }).__ktCls ?? 0);
  expect(cls).toBeLessThan(0.1);

  // --- TA-05: đọc inbox qua API thật và accept đúng một pending trial ---
  const inbox = page.waitForResponse(
    (r) => r.url().includes("/trials/mine") && r.request().method() === "GET",
  );
  await page.locator(".sidebar").getByRole("link", { name: "Học thử", exact: true }).click();
  expect((await inbox).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Yêu cầu học thử" })).toBeVisible();
  const trialCard = page.locator('.trial-card[data-status="pending"]', {
    hasText: E2E_TRIAL_SUBJECT,
  });
  await expect(trialCard).toBeVisible();
  await trialCard.getByText("Xem chi tiết yêu cầu").click();
  await expect(trialCard.getByText(/chưa thể tự xác nhận trùng lịch/i)).toBeVisible();
  await expect(trialCard.getByText(/Không có dữ liệu liên hệ nào được tải/i)).toBeVisible();

  const acceptTrial = page.waitForResponse(
    (r) => r.url().includes("/trials/") && r.url().endsWith("/accept") && r.request().method() === "POST",
  );
  await trialCard.getByRole("button", { name: "Nhận dạy thử" }).click();
  expect((await acceptTrial).status()).toBe(201);
  await expect(trialCard.getByText("Lớp học thử đã được tạo.")).toBeVisible();
  await expect(trialCard.getByRole("link", { name: /Mở lớp/ })).toBeVisible();
  await expect(trialCard.getByText(/không cần kích hoạt/i)).toBeVisible();

  await page.locator(".sidebar").getByRole("link", { name: "Lịch rảnh", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/availability");

  // --- TA-03: lịch rảnh — thêm rồi xóa khung giờ (POST 201 / DELETE 200) ---
  await expect(page.getByRole("heading", { name: "Lịch rảnh trong tuần" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Danh sách khung giờ" })).toBeVisible();

  await page.getByRole("button", { name: "+ Thêm khung giờ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Thứ").selectOption("4");
  await dialog.getByLabel("Bắt đầu").fill("07:00");
  await dialog.getByLabel("Kết thúc").fill("08:00");

  const create = page.waitForResponse(
    (r) => r.url().includes("/tutors/me/availabilities") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu khung giờ" }).click();
  expect((await create).status()).toBe(201);

  const row = page.locator(".avail-row", { hasText: "Thứ Sáu · 07:00–08:00" });
  await expect(row).toBeVisible();

  const del = page.waitForResponse(
    (r) => r.url().includes("/tutors/me/availabilities/") && r.request().method() === "DELETE",
  );
  await row.getByRole("button", { name: "Xóa" }).click();
  expect((await del).status()).toBe(200);
  await expect(row).toHaveCount(0);

  // --- TA-02: hồ sơ — điều hướng client-side (không reload) và kiểm dữ liệu thật ---
  await page.getByRole("link", { name: "Hồ sơ gia sư" }).click();
  await page.waitForURL((url) => url.pathname === "/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ gia sư" })).toBeVisible();
  await expect(page.getByLabel(/Tên hiển thị/)).toHaveValue("Cô E2E");
});
