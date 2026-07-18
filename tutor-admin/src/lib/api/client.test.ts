import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { createMemoryTokenStore } from "./session";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("calls the browser fetch with globalThis as receiver", async () => {
    const originalFetch = globalThis.fetch;
    const browserFetch = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(json({ ok: true }));
    });
    globalThis.fetch = browserFetch as typeof fetch;
    try {
      const client = new ApiClient({ baseUrl: "https://api.test" });
      await expect(
        client.request("/health", { skipAuth: true }),
      ).resolves.toEqual({ ok: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshes once for concurrent expired requests and preserves request ID", async () => {
    const store = createMemoryTokenStore({ access_token: "old" });
    let refreshes = 0;
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("x-request-id")).toBeTruthy();
        if (headers.get("authorization") === "Bearer old")
          return json({ code: "AUTH_REQUIRED", message: "Hết phiên" }, 401);
        if (String(_input).endsWith("/auth/admin/refresh")) {
          refreshes += 1;
          return json({ access_token: "new" });
        }
        return json({ ok: true });
      },
    );
    const client = new ApiClient({
      baseUrl: "https://api.test",
      fetcher: fetcher as typeof fetch,
      tokenStore: store,
    });
    await expect(
      Promise.all([
        client.request("/admin/users"),
        client.request("/admin/payments"),
      ]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
    expect(
      fetcher.mock.calls.every(([, init]) => init?.credentials === "include"),
    ).toBe(true);
  });

  it("normalizes forbidden errors without refresh", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          code: "FORBIDDEN_ROLE",
          message: "Không có quyền",
          request_id: "req-403",
        },
        403,
      ),
    );
    const client = new ApiClient({
      baseUrl: "https://api.test",
      fetcher: fetcher as typeof fetch,
      tokenStore: createMemoryTokenStore({ access_token: "a" }),
    });
    await expect(client.request("/admin/overview")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN_ROLE",
      requestId: "req-403",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries a concurrent cross-tab refresh without expiring the shared cookie", async () => {
    const store = createMemoryTokenStore();
    let refreshes = 0;
    const fetcher = vi.fn(async () => {
      refreshes += 1;
      if (refreshes === 1)
        return json(
          { code: "CONFLICT", message: "Phiên đang được làm mới" },
          409,
        );
      return json({ access_token: "restored" });
    });
    const client = new ApiClient({
      baseUrl: "https://api.test",
      fetcher: fetcher as typeof fetch,
      tokenStore: store,
    });

    await expect(client.restoreSession()).resolves.toEqual({
      access_token: "restored",
    });
    expect(refreshes).toBe(2);
    expect(store.get()).toEqual({ access_token: "restored" });
  });

  it("does not issue a request for an already aborted signal", async () => {
    const fetcher = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const client = new ApiClient({
      baseUrl: "https://api.test",
      fetcher: fetcher as typeof fetch,
    });
    await expect(
      client.request("/admin/users", { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "REQUEST_ABORTED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  // Regression R-04: native browser `fetch` yêu cầu `this === window`. Client
  // mặc định (không inject fetcher) phải gọi global fetch với receiver đúng,
  // nếu không trình duyệt ném "Illegal invocation" trước khi request rời máy.
  it("gọi global fetch mặc định với receiver đúng (không Illegal invocation)", async () => {
    const original = globalThis.fetch;
    const strictFetch = function (this: unknown) {
      if (this !== globalThis && this !== undefined) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(json({ ok: true }));
    };
    globalThis.fetch = strictFetch as typeof fetch;
    try {
      const client = new ApiClient({ baseUrl: "https://api.test", tokenStore: createMemoryTokenStore() });
      await expect(client.request("/health", { skipAuth: true })).resolves.toEqual({ ok: true });
    } finally {
      globalThis.fetch = original;
    }
  });
});
