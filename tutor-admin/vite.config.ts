import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    headers: securityHeaders,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  preview: { port: 4175, headers: securityHeaders },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: true },
});
