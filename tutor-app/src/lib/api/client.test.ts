import type { AuthTokens } from "@kimthanh-tutor/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { ApiClientError } from "./errors";
import { createMemoryTokenStore } from "./session";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("ApiClient", () => {
  it("shares one refresh across concurrent 401 responses", async () => {
    const store = createMemoryTokenStore({ access_token: "old", refresh_token: "refresh-1" });
    let refreshCalls = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return json({ access_token: "new", refresh_token: "refresh-2" } satisfies AuthTokens);
      }
      return new Headers(init?.headers).get("authorization") === "Bearer new" ? json({ ok: true }) : json({ code: "AUTH_REQUIRED", message: "Hết phiên" }, 401);
    });
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch, tokenStore: store });

    await expect(Promise.all([client.request("/classes"), client.request("/trials")])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(store.get()).toEqual({ access_token: "new", refresh_token: "refresh-2" });
  });

  it("normalizes API errors and does not refresh a 403", async () => {
    const fetcher = vi.fn(async () => json({ code: "FORBIDDEN_ROLE", message: "Không có quyền", request_id: "req-403" }, 403));
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch, tokenStore: createMemoryTokenStore({ access_token: "a", refresh_token: "r" }) });

    const error = await client.request("/admin").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 403, code: "FORBIDDEN_ROLE", requestId: "req-403" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("adds request and idempotency headers", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-request-id")).toBeTruthy();
      expect(headers.get("idempotency-key")).toBe("idem-01");
      expect(headers.get("authorization")).toBe("Bearer access");
      expect(init).not.toHaveProperty("timeoutMs");
      expect(init).not.toHaveProperty("idempotencyKey");
      expect(init).not.toHaveProperty("skipAuth");
      return json({ id: "payment-1" });
    });
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch, tokenStore: createMemoryTokenStore({ access_token: "access", refresh_token: "refresh" }) });
    await client.request("/billing/checkout", { method: "POST", body: { product_type: "tutor_qr" }, idempotencyKey: "idem-01" });
  });

  it("maps timeout and caller abort separately", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch, timeoutMs: 5 });
    await expect(client.request("/slow", { skipAuth: true })).rejects.toMatchObject({ kind: "timeout", code: "REQUEST_TIMEOUT" });

    const controller = new AbortController();
    const pending = client.request("/cancel", { skipAuth: true, signal: controller.signal, timeoutMs: 1_000 });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted", code: "REQUEST_ABORTED" });
  });

  it("does not start a request when the caller signal was already aborted", async () => {
    const fetcher = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch });

    await expect(client.request("/cancelled", { skipAuth: true, signal: controller.signal })).rejects.toMatchObject({ kind: "aborted", code: "REQUEST_ABORTED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the refresh token on a transient refresh failure", async () => {
    const store = createMemoryTokenStore({ access_token: "expired", refresh_token: "still-valid" });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/auth/refresh")) throw new TypeError("network down");
      return json({ code: "AUTH_REQUIRED", message: "Hết phiên" }, 401);
    });
    const expired = vi.fn();
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch, tokenStore: store, onSessionExpired: expired });

    await expect(client.request("/auth/me")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(store.get()).toEqual({ access_token: "expired", refresh_token: "still-valid" });
    expect(expired).not.toHaveBeenCalled();
  });

  it("clears the session after the server rejects refresh", async () => {
    const store = createMemoryTokenStore({ access_token: "expired", refresh_token: "revoked" });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/auth/refresh")
      ? json({ code: "AUTH_REQUIRED", message: "Phiên bị thu hồi" }, 401)
      : json({ code: "AUTH_REQUIRED", message: "Hết phiên" }, 401));
    const expired = vi.fn();
    const client = new ApiClient({ baseUrl: "https://api.test", fetcher: fetcher as typeof fetch, tokenStore: store, onSessionExpired: expired });

    await expect(client.request("/auth/me")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(store.get()).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });
});
