import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apiRaw } from "./api";

// Định danh TÀI KHOẢN test (không phải thông tin DB). Override qua env khi cần.
export const E2E_TUTOR_EMAIL = process.env.E2E_TUTOR_EMAIL || "tutor.e2e@gmail.com";
export const E2E_PARENT_EMAIL = process.env.E2E_PARENT_EMAIL || "parent.e2e@gmail.com";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin.e2e@example.com";
// id char(26) cố định cho tài khoản admin (không cần đúng ULID; upsert theo email).
const ADMIN_ID = "e2eadmin000000000000000000";

// Truy cập DB/API qua chính docker-compose (service `db`/`api`) — không hardcode
// tên container, không nhúng credential DB (đã nằm trong docker-compose.yml).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const TUTOR_API_ROOT = join(REPO_ROOT, "tutor-api");
function composeExec(service: string, command: string, env: string[] = []): void {
  const envFlags = env.map((e) => `-e ${e}`).join(" ");
  // docker-compose.yml thuộc tutor-api/; chạy từ root sẽ không tìm thấy file
  // sau khi Docker assets được gom về đúng bounded app.
  execSync(`docker compose exec -T ${envFlags} ${service} ${command}`, { cwd: TUTOR_API_ROOT, stdio: "ignore" });
}

function tokenFromLink(link: unknown): string | null {
  if (typeof link !== "string") return null;
  const match = /token=([^&]+)/.exec(link);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Seed điều khoản pháp lý qua DB container (consent gate cần active docs). */
export function seedLegalDocs(): void {
  const sql =
    "update legal_documents set is_active=false where doc_type in ('terms','privacy'); " +
    "insert into legal_documents (id,doc_type,version,locale,title,content_url,checksum,is_active,published_at) values " +
    "('01KXFLOWTERMS0000000000000','terms','2026-07-flow','vi-VN','Dieu khoan','https://e.test/t','c1',true,now())," +
    "('01KXFLOWPRIVACY00000000000','privacy','2026-07-flow','vi-VN','Chinh sach','https://e.test/p','c2',true,now()) " +
    "on conflict (doc_type,version) do update set is_active=excluded.is_active;";
  composeExec("db", `psql -U postgres -d tutor -v ON_ERROR_STOP=1 -c "${sql}"`);
}

/**
 * Gia sư đã verify + đúng password + đã consent + có hồ sơ để vào route bảo vệ.
 * Idempotent với mọi trạng thái trước đó: register (best-effort) → verify (nếu
 * pending) → reset password về giá trị run hiện tại → login → consent → profile.
 */
export async function ensureTutorAccount(password: string, email = E2E_TUTOR_EMAIL): Promise<void> {
  await apiRaw("/auth/register", { method: "POST", body: { email, password } });

  const resend = await apiRaw("/auth/email/verify/resend", { method: "POST", body: { email } });
  const verifyToken = tokenFromLink(resend.body.dev_verification_link);
  if (verifyToken) {
    await apiRaw("/auth/email/verify", { method: "POST", body: { token: verifyToken } });
  }

  // Đưa password về giá trị của run hiện tại dù account có từ run trước.
  const forgot = await apiRaw("/auth/password/forgot", { method: "POST", body: { email } });
  const resetToken = tokenFromLink(forgot.body.dev_reset_link);
  if (resetToken) {
    await apiRaw("/auth/password/reset", { method: "POST", body: { token: resetToken, password } });
  }

  const login = await apiRaw("/auth/login", { method: "POST", body: { email, password } });
  const token = String(login.body.access_token ?? "");

  const docs = await apiRaw("/legal/documents/active");
  const terms = docs.body.terms as { id: string };
  const privacy = docs.body.privacy as { id: string };
  await apiRaw("/legal/consents", {
    method: "POST",
    token,
    body: {
      terms_document_id: terms.id,
      privacy_document_id: privacy.id,
      scroll_reached_bottom: true,
      consent_method: "scroll_and_click",
    },
  });

  const existing = await apiRaw("/tutors/me/profile", { token });
  if (existing.status !== 200) {
    await apiRaw("/tutors/me/profile", {
      method: "POST",
      token,
      body: {
        display_name: "Cô E2E",
        bio: "Tài khoản smoke E2E cho tutor-app: gia sư Toán cấp 2, luyện nền tảng.",
        region: "Ha Noi",
        gender: "female",
        subjects: ["math"],
        grade_levels: [6, 7],
        teaching_modes: ["online"],
        expected_fee_min: 150000,
        expected_fee_max: 250000,
      },
    });
  }
}

/** Đăng ký + verify + reset password (đưa về run hiện tại) + login + consent → token. */
async function registerVerifyLoginConsent(email: string, password: string): Promise<string> {
  await apiRaw("/auth/register", { method: "POST", body: { email, password } });
  const resend = await apiRaw("/auth/email/verify/resend", { method: "POST", body: { email } });
  const verifyToken = tokenFromLink(resend.body.dev_verification_link);
  if (verifyToken) await apiRaw("/auth/email/verify", { method: "POST", body: { token: verifyToken } });
  const forgot = await apiRaw("/auth/password/forgot", { method: "POST", body: { email } });
  const resetToken = tokenFromLink(forgot.body.dev_reset_link);
  if (resetToken) await apiRaw("/auth/password/reset", { method: "POST", body: { token: resetToken, password } });

  const login = await apiRaw("/auth/login", { method: "POST", body: { email, password } });
  const token = String(login.body.access_token ?? "");

  const docs = await apiRaw("/legal/documents/active");
  const terms = docs.body.terms as { id: string };
  const privacy = docs.body.privacy as { id: string };
  await apiRaw("/legal/consents", {
    method: "POST",
    token,
    body: {
      terms_document_id: terms.id,
      privacy_document_id: privacy.id,
      scroll_reached_bottom: true,
      consent_method: "scroll_and_click",
    },
  });
  return token;
}

/** Phụ huynh đã verify + đúng password + đã consent (status active) để vào khu vực private. */
export async function ensureParentAccount(password: string, email = E2E_PARENT_EMAIL): Promise<void> {
  await registerVerifyLoginConsent(email, password);
}

/**
 * Provision admin (đăng nhập bằng /auth/admin/password, credential riêng). Tạo
 * user admin trực tiếp qua DB container rồi set password qua CLI
 * `set-admin-password` — không dùng luồng register email (admin email không
 * thuộc miền gmail/edu).
 */
export async function ensureAdminAccount(adminPassword: string): Promise<void> {
  const sql =
    `insert into users (id, email, roles, status, email_verified_at, created_at, updated_at) ` +
    `values ('${ADMIN_ID}', '${ADMIN_EMAIL}', ARRAY['admin'], 'active', now(), now(), now()) ` +
    `on conflict (email) do update set roles=ARRAY['admin'], status='active', deleted_at=null, email_verified_at=now();`;
  composeExec("db", `psql -U postgres -d tutor -v ON_ERROR_STOP=1 -c "${sql}"`);
  composeExec("api", "node dist/scripts/set-admin-password.js", [
    `ADMIN_EMAIL='${ADMIN_EMAIL}'`,
    `ADMIN_PASSWORD='${adminPassword}'`,
  ]);
}
