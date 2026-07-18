const API = (process.env.E2E_API_BASE || "http://127.0.0.1:3000/api/v1").replace(/\/$/, "");

export const API_HEALTH = API.replace(/\/api\/v1$/, "") + "/healthz";

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

/** Gọi API dev trực tiếp (server-side, không qua browser) cho seed. */
export async function apiRaw(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}
