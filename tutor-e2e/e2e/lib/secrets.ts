import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Bí mật E2E (vd password admin) KHÔNG được commit. Sinh ngẫu nhiên lúc chạy và
// lưu vào file gitignored, anchor theo vị trí file (không phụ thuộc cwd).
const STATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../.e2e-state");
const FILE = join(STATE_DIR, "secrets.json");

export interface E2ESecrets {
  adminPassword: string;
  userPassword: string;
}

/** Gọi ở global-setup: lấy từ env (CI) hoặc sinh mới, rồi ghi ra file gitignored. */
export function provisionSecrets(): E2ESecrets {
  const secrets: E2ESecrets = {
    adminPassword: process.env.E2E_ADMIN_PASSWORD || `e2e-${randomBytes(16).toString("hex")}`,
    userPassword: process.env.E2E_USER_PASSWORD || `e2e-${randomBytes(16).toString("hex")}`,
  };
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(secrets, null, 2), "utf8");
  return secrets;
}

/** Đọc ở test worker. */
export function readSecrets(): E2ESecrets {
  return JSON.parse(readFileSync(FILE, "utf8")) as E2ESecrets;
}
