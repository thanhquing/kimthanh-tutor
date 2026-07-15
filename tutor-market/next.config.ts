import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
};

export default nextConfig;
