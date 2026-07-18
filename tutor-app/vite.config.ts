import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// App gia sư là bề mặt private, không được index. Header production/CSP thật
// đặt ở reverse proxy/CDN (xem DEPLOYMENT.md); dev/preview vẫn set tối thiểu.
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    headers: securityHeaders,
    // Dev-only: chuyển tiếp lời gọi cùng-origin `/api/*` sang API để tránh
    // cross-origin/CORS và rắc rối IPv4/IPv6 khi chạy local. Không ảnh hưởng
    // build production (API base thật đóng qua VITE_API_BASE_URL / reverse proxy).
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4174,
    headers: securityHeaders,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
