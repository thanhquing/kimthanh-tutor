import { defineConfig } from "@playwright/test";

// Smoke E2E chạy trên browser thật (Chrome hệ thống) với API dockerized.
// Yêu cầu trước khi chạy: `docker compose up -d db api` (API tại localhost:3000).
// Xem ai-tasks/06-verification.md §"Frontend E2E smoke".
const PORT = Number(process.env.E2E_PORT || 5174);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec vite --host --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { API_PROXY_TARGET: process.env.API_PROXY_TARGET || "http://127.0.0.1:3000" },
  },
});
