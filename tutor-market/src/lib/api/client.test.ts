import { describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { createMemoryTokenStore } from "./session";
describe("ApiClient", () => {
  it("refresh một lần khi nhiều request cùng nhận 401", async () => {
    const store = createMemoryTokenStore(); store.set({ access_token: "old", refresh_token: "refresh" });
    let refreshed = 0;
    const fetcher: typeof fetch = async (input, init) => { const path = String(input); if (path.endsWith("/auth/refresh")) { refreshed += 1; return new Response(JSON.stringify({ access_token: "new", refresh_token: "new-refresh" })); } if (new Headers(init?.headers).get("authorization") === "Bearer old") return new Response("", { status: 401 }); return new Response(JSON.stringify({ ok: true })); };
    const client = new ApiClient({ baseUrl: "https://api.example", fetcher, tokenStore: store });
    await Promise.all([client.request("/private"), client.request("/private")]);
    expect(refreshed).toBe(1);
  });
  it("không retry 401 khi request không có access token", async () => {
    let requests = 0;
    const client = new ApiClient({
      baseUrl: "https://api.example",
      fetcher: async () => {
        requests += 1;
        return new Response("", { status: 401 });
      },
    });

    await expect(client.request("/private")).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
    expect(requests).toBe(1);
  });
  it("chuẩn hóa API error có request id", async () => {
    const client = new ApiClient({
      baseUrl: "https://api.example",
      fetcher: async () => new Response(JSON.stringify({ code: "FORBIDDEN", message: "Không có quyền", request_id: "req-1" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(client.request("/private", { skipAuth: true })).rejects.toMatchObject({
      kind: "api",
      status: 403,
      code: "FORBIDDEN",
      requestId: "req-1",
    });
  });
  it("gắn idempotency key cho mutation", async () => { let headers = new Headers(); const client = new ApiClient({ baseUrl: "https://api.example", fetcher: async (_input, init) => { headers = new Headers(init?.headers); return new Response(JSON.stringify({ ok: true })); } }); await client.request("/billing/checkout", { method: "POST", body: { product_type: "single_unlock" }, idempotencyKey: "once" }); expect(headers.get("idempotency-key")).toBe("once"); });

  // Regression R-01: native browser `fetch` yêu cầu `this === window`. Khi không
  // inject fetcher, ApiClient dùng global fetch; nếu gọi mà `this` sai, trình
  // duyệt ném "Illegal invocation" trước khi request rời máy → hỏng mọi API call.
  it("gọi global fetch mặc định với receiver đúng (không Illegal invocation)", async () => {
    const original = globalThis.fetch;
    const strictFetch = function (this: unknown) {
      if (this !== globalThis && this !== undefined) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }));
    };
    globalThis.fetch = strictFetch as typeof fetch;
    try {
      const client = new ApiClient({ baseUrl: "https://api.example", tokenStore: createMemoryTokenStore() });
      await expect(client.request("/health", { skipAuth: true })).resolves.toEqual({ ok: true });
    } finally {
      globalThis.fetch = original;
    }
  });
});
