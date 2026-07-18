import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  // Client shell riêng tư gọi API cùng-origin qua `/api/*`; Next chuyển tiếp
  // sang API để tránh cross-origin/CORS khi chạy local (mirror dev proxy của
  // tutor-app/tutor-admin). SSR public vẫn fetch server-side qua marketConfig.
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
