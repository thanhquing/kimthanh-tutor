import { execSync } from "node:child_process";

/** Tài khoản gia sư dùng cho smoke E2E (SĐT + OTP dev cố định). */
export const E2E_TUTOR_PHONE = process.env.E2E_PHONE || "0900009003";
export const DEV_OTP = "272727";
const API = (process.env.E2E_API_BASE || "http://127.0.0.1:3000/api/v1").replace(/\/$/, "");

type Json = Record<string, unknown>;

async function api<T = Json>(path: string, init?: RequestInit & { token?: string }): Promise<{ status: number; body: T }> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (init?.token) headers.set("authorization", `Bearer ${init.token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as T };
}

/** Seed điều khoản pháp lý qua DB container (consent gate cần active docs). Best-effort. */
export function seedLegalDocs() {
  const sql =
    "update legal_documents set is_active=false where doc_type in ('terms','privacy'); " +
    "insert into legal_documents (id,doc_type,version,locale,title,content_url,checksum,is_active,published_at) values " +
    "('01KXFLOWTERMS0000000000000','terms','2026-07-flow','vi-VN','Dieu khoan','https://e.test/t','c1',true,now())," +
    "('01KXFLOWPRIVACY00000000000','privacy','2026-07-flow','vi-VN','Chinh sach','https://e.test/p','c2',true,now()) " +
    "on conflict (doc_type,version) do update set is_active=excluded.is_active;";
  const container = process.env.E2E_DB_CONTAINER || "kimthanh-tutor-db-1";
  execSync(`docker exec -i ${container} psql -U postgres -d tutor -v ON_ERROR_STOP=1 -c "${sql}"`, { stdio: "ignore" });
}

/** Đảm bảo có tài khoản gia sư đã consent + có hồ sơ để login vào được /availability. */
export async function ensureTutorAccount(phone = E2E_TUTOR_PHONE) {
  const otp = await api<{ request_id: string }>("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ channel: "sms", destination: phone }),
  });
  const verify = await api<{ access_token: string }>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ request_id: otp.body.request_id, code: DEV_OTP }),
  });
  const token = verify.body.access_token;

  const docs = await api<{ terms: { id: string }; privacy: { id: string } }>("/legal/documents/active");
  await api("/legal/consents", {
    method: "POST",
    token,
    body: JSON.stringify({
      terms_document_id: docs.body.terms.id,
      privacy_document_id: docs.body.privacy.id,
      scroll_reached_bottom: true,
      consent_method: "scroll_and_click",
    }),
  });

  const existing = await api("/tutors/me/profile", { token });
  if (existing.status !== 200) {
    await api("/tutors/me/profile", {
      method: "POST",
      token,
      body: JSON.stringify({
        display_name: "Cô E2E",
        bio: "Tài khoản smoke E2E cho tutor-app: gia sư Toán cấp 2, luyện nền tảng.",
        region: "Ha Noi",
        gender: "female",
        subjects: ["math"],
        grade_levels: [6, 7],
        teaching_modes: ["online"],
        expected_fee_min: 150000,
        expected_fee_max: 250000,
      }),
    });
  }
  return { token };
}
