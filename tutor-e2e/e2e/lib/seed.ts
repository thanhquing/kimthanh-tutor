import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apiRaw } from "./api";

// Định danh TÀI KHOẢN test (không phải thông tin DB): smoke cần biết đăng nhập
// bằng SĐT/email nào. Override qua env khi chạy trên môi trường khác.
export const E2E_TUTOR_PHONE = process.env.E2E_TUTOR_PHONE || "0900009003";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin.e2e@example.com";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || "0900009175";

// Truy cập DB/API qua chính docker-compose (service `db`/`api`) — không hardcode
// tên container, không nhúng credential DB (đã nằm trong docker-compose.yml).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
function composeExec(service: string, command: string, env: string[] = []): void {
  const envFlags = env.map((e) => `-e ${e}`).join(" ");
  execSync(`docker compose exec -T ${envFlags} ${service} ${command}`, { cwd: REPO_ROOT, stdio: "ignore" });
}

/** Login OTP dev: mã lấy từ `dev_code` trong response (không hardcode). */
async function loginOtp(phone: string): Promise<string> {
  const otp = await apiRaw("/auth/otp/request", { method: "POST", body: { channel: "sms", destination: phone } });
  const verify = await apiRaw("/auth/otp/verify", {
    method: "POST",
    body: { request_id: otp.body.request_id, code: otp.body.dev_code },
  });
  return String(verify.body.access_token);
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

/** Gia sư đã consent + có hồ sơ để vào được các route bảo vệ của tutor-app. */
export async function ensureTutorAccount(phone = E2E_TUTOR_PHONE): Promise<void> {
  const token = await loginOtp(phone);
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

/**
 * Provision admin: tạo user qua OTP → nâng role admin + active qua DB container →
 * set password (do global-setup sinh) qua CLI `set-admin-password` trong API
 * container (đúng đường provision ngoài UI). Idempotent theo SĐT.
 */
export async function ensureAdminAccount(adminPassword: string): Promise<void> {
  await loginOtp(ADMIN_PHONE);
  const sql =
    `update users set email='${ADMIN_EMAIL}', roles=ARRAY['admin'], status='active', deleted_at=null ` +
    `where phone='${ADMIN_PHONE}';`;
  composeExec("db", `psql -U postgres -d tutor -v ON_ERROR_STOP=1 -c "${sql}"`);
  composeExec("api", "node dist/scripts/set-admin-password.js", [
    `ADMIN_EMAIL='${ADMIN_EMAIL}'`,
    `ADMIN_PASSWORD='${adminPassword}'`,
  ]);
}
