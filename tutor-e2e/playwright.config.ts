import { defineConfig } from "@playwright/test";

// E2E smoke browser thật cho cả 3 app, gom về một project để đồng bộ config +
// seed + cách chạy. Chrome hệ thống (channel chrome, không tải browser).
//
// Yêu cầu: API dockerized đang chạy — `docker compose up -d db api` (từ root).
// Chạy tất cả:      pnpm --filter @kimthanh-tutor/e2e test
// Chạy một app:     pnpm --filter @kimthanh-tutor/e2e test:app | test:admin | test:market
//
// KHÔNG hardcode secret: password admin sinh ngẫu nhiên lúc chạy (gitignored),
// mã OTP đọc từ response API. Xem ai-tasks/06-verification.md §Frontend E2E smoke.

const APP_PORT = Number(process.env.E2E_APP_PORT || 5174);
const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT || 5175);
const MARKET_PORT = Number(process.env.E2E_MARKET_PORT || 3001);
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3000/api/v1";
// Local/CI tiếp tục dùng Chrome hệ thống. Docker Playwright có thể đặt chuỗi
// rỗng để dùng Chromium được image cung cấp, tránh tải browser lúc verify.
const browserChannel = process.env.E2E_BROWSER_CHANNEL ?? "chrome";
const targetProject = process.env.E2E_TARGET_PROJECT;

export default defineConfig({
  globalSetup: "./global-setup.ts",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "tutor-app", testDir: "./e2e/tutor-app", use: { baseURL: `http://localhost:${APP_PORT}` } },
    { name: "tutor-admin", testDir: "./e2e/tutor-admin", use: { baseURL: `http://localhost:${ADMIN_PORT}` } },
    {
      name: "tutor-market",
      testDir: "./e2e/tutor-market",
      use: { baseURL: `http://localhost:${MARKET_PORT}`, navigationTimeout: 45_000 },
    },
  ],
  // Cổng do config từng app quyết định (vite.config: 5174/5175; market dev:
  // next --port 3001). Chạy thẳng script `dev`, không truyền args qua `--`
  // (pnpm --filter + `--` nuốt cờ ở phiên bản này).
  webServer: [
    {
      command: "pnpm --filter tutor-app dev",
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET },
    },
    {
      command: "pnpm --filter tutor-admin dev",
      url: `http://localhost:${ADMIN_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter tutor-market dev",
      url: `http://localhost:${MARKET_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_BASE_URL },
    },
  ].filter((_, index) => !targetProject || ["tutor-app", "tutor-admin", "tutor-market"][index] === targetProject),
});
