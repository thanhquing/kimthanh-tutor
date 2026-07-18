import { ensureTutorAccount, seedLegalDocs } from "./seed";

const HEALTH = (process.env.E2E_API_BASE || "http://127.0.0.1:3000/api/v1").replace(/\/api\/v1\/?$/, "") + "/healthz";

export default async function globalSetup() {
  const health = await fetch(HEALTH).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `API chưa sẵn sàng tại ${HEALTH}. Chạy trước: docker compose up -d db api (từ root repo).`,
    );
  }
  try {
    seedLegalDocs();
  } catch {
    // Không seed được qua docker (vd DB container khác tên) → giả định đã seed từ trước.
    // Bước consent sẽ báo lỗi rõ nếu thiếu active legal docs.
  }
  await ensureTutorAccount();
}
