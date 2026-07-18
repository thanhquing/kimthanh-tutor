import { API_HEALTH } from "./e2e/lib/api";
import { provisionSecrets } from "./e2e/lib/secrets";
import { ensureAdminAccount, ensureParentAccount, ensureTutorAccount, seedLegalDocs } from "./e2e/lib/seed";

export default async function globalSetup() {
  const health = await fetch(API_HEALTH).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(`API chưa sẵn sàng tại ${API_HEALTH}. Chạy trước: docker compose up -d db api (từ root repo).`);
  }
  const { adminPassword, userPassword } = provisionSecrets();
  try {
    seedLegalDocs();
  } catch {
    // Không seed được qua docker (vd container khác tên) → giả định đã seed sẵn.
  }
  await ensureTutorAccount(userPassword);
  await ensureParentAccount(userPassword);
  await ensureAdminAccount(adminPassword);
}
