import { expect, test } from "@playwright/test";
import { loginViaPassword } from "./helpers";
import { E2E_TRIAL_SUBJECT } from "../lib/seed";

// Smoke tutor-app: một phiên đăng nhập email+password bao phủ TA-02 (hồ sơ),
// TA-03 (lịch), TA-04 (dashboard), TA-05 (trial), TA-06 (class state),
// TA-07 (sổ đầu bài), TA-08 (tài khoản nhận tiền), điều hướng trong cùng phiên.
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
  const acceptTrialResponse = await acceptTrial;
  expect(acceptTrialResponse.status()).toBe(201);
  const acceptBody = await acceptTrialResponse.json() as { class_contract: { id: string } };
  const classId = acceptBody.class_contract.id;
  const acceptedTrialCard = page.locator(".trial-card", {
    has: page.locator(`a[href="/classes/${classId}"]`),
  });
  await expect(acceptedTrialCard.getByText("Lớp học thử đã được tạo.")).toBeVisible();
  await expect(acceptedTrialCard.getByRole("link", { name: /Mở lớp/ })).toBeVisible();
  await expect(acceptedTrialCard.getByText(/không cần kích hoạt/i)).toBeVisible();

  // --- TA-06: detail owner-safe và state machine dùng expected_version ---
  const classDetail = page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith(`/classes/${classId}`) && r.request().method() === "GET",
  );
  await Promise.all([
    page.waitForURL((url) => url.pathname === `/classes/${classId}`),
    acceptedTrialCard.getByRole("link", { name: /Mở lớp/ }).click(),
  ]);
  expect((await classDetail).status()).toBe(200);
  await expect(page.locator(".class-detail-heading").getByRole("heading", { name: E2E_TRIAL_SUBJECT })).toBeVisible();
  await expect(page.getByText(/không phải lịch hợp đồng đã xác nhận/i)).toBeVisible();

  const startClass = page.waitForResponse(
    (r) => r.url().includes("/transition") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Bắt đầu / tiếp tục" }).click();
  expect((await startClass).status()).toBe(201);
  await expect(page.getByText("Đang học")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mở sổ đầu bài" })).toBeVisible();

  // --- TA-07: list/create/edit sổ đầu bài qua API thật ---
  const lessonList = page.waitForResponse(
    (r) => /\/classes\/[^/]+\/lesson-logs(?:\?|$)/.test(r.url()) && r.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Mở sổ đầu bài" }).click();
  expect((await lessonList).status()).toBe(200);
  await expect(page.getByRole("heading", { name: `Sổ đầu bài · ${E2E_TRIAL_SUBJECT}` })).toBeVisible();

  await page.getByRole("button", { name: "Ghi buổi học" }).click();
  const lessonDialog = page.getByRole("dialog");
  await lessonDialog.getByLabel("Môn/chủ đề").fill("Đại số TA-07 E2E");
  await lessonDialog.getByLabel("Nội dung đã học").fill("Ôn phương trình bậc nhất");
  await lessonDialog.getByLabel("Mức độ tiếp thu").selectOption("normal");
  await lessonDialog.getByLabel("Nhận xét chia sẻ với phụ huynh").fill("Cần luyện thêm bài vận dụng");
  const createLesson = page.waitForResponse(
    (r) => /\/classes\/[^/]+\/lesson-logs$/.test(new URL(r.url()).pathname) && r.request().method() === "POST",
  );
  await lessonDialog.getByRole("button", { name: "Lưu buổi học" }).click();
  const createLessonResponse = await createLesson;
  expect(createLessonResponse.status()).toBe(201);
  expect(createLessonResponse.request().postDataJSON()).not.toHaveProperty("class_id");

  const lessonCard = page.locator(".lesson-log-card", { hasText: "Đại số TA-07 E2E" });
  await expect(lessonCard).toBeVisible();
  await lessonCard.getByRole("button", { name: "Sửa buổi học" }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Môn/chủ đề").fill("Hình học TA-07 E2E");
  await editDialog.getByLabel("Mức độ tiếp thu").selectOption("good");
  const updateLesson = page.waitForResponse(
    (r) => /\/lesson-logs\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === "PATCH",
  );
  await editDialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  expect((await updateLesson).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Hình học TA-07 E2E" })).toBeVisible();

  const classDetailAfterLesson = page.waitForResponse(
    (r) => /\/classes\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Chi tiết lớp" }).click();
  expect((await classDetailAfterLesson).status()).toBe(200);

  await page.getByRole("button", { name: "Tạm dừng lớp" }).click();
  const pauseDialog = page.getByRole("dialog");
  await expect(pauseDialog).toBeVisible();
  const pauseClass = page.waitForResponse(
    (r) => r.url().includes("/transition") && r.request().method() === "POST",
  );
  await pauseDialog.getByRole("button", { name: "Tạm dừng" }).click();
  expect((await pauseClass).status()).toBe(201);
  await expect(page.getByText("Tạm dừng")).toBeVisible();

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

  // --- TA-08: chọn bank từ catalog + tạo account, UI chỉ render masked value ---
  const payoutBanks = page.waitForResponse(
    (r) => r.url().includes("/tutors/me/payout-accounts/banks") && r.request().method() === "GET",
  );
  const payoutList = page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith("/tutors/me/payout-accounts") && r.request().method() === "GET",
  );
  await page.locator(".sidebar").getByRole("link", { name: "Tài khoản nhận tiền", exact: true }).click();
  expect((await payoutBanks).status()).toBe(200);
  const payoutListResponse = await payoutList;
  expect(payoutListResponse.status()).toBe(200);
  const existingPayouts = await payoutListResponse.json() as { items?: unknown[] };
  const firstPayoutAccount = (existingPayouts.items?.length ?? 0) === 0;
  await expect(page.getByRole("heading", { name: "Tài khoản nhận tiền", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thêm tài khoản", exact: true }).click();
  const payoutDialog = page.getByRole("dialog");
  await payoutDialog.getByLabel("Ngân hàng").selectOption("970436");
  await payoutDialog.getByLabel("Số tài khoản").fill("1234 567-890");
  await payoutDialog.getByLabel("Tên chủ tài khoản").fill("NGUYEN THI LINH");
  const createPayout = page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith("/tutors/me/payout-accounts") && r.request().method() === "POST",
  );
  await payoutDialog.getByRole("button", { name: "Lưu tài khoản" }).click();
  const createPayoutResponse = await createPayout;
  expect(createPayoutResponse.status()).toBe(201);
  expect(createPayoutResponse.request().postDataJSON()).toMatchObject({ bank_code: "970436", is_default: firstPayoutAccount });
  await expect(page.getByText("****7890 · NGUYEN THI LINH")).toBeVisible();
  await expect(page.getByText("1234567890")).toHaveCount(0);

  // --- TA-02: hồ sơ — điều hướng client-side (không reload) và kiểm dữ liệu thật ---
  await page.getByRole("link", { name: "Hồ sơ gia sư" }).click();
  await page.waitForURL((url) => url.pathname === "/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ gia sư" })).toBeVisible();
  await expect(page.getByLabel(/Tên hiển thị/)).toHaveValue("Cô E2E");
});
