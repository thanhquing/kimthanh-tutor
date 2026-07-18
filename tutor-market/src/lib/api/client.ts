import type { AuthTokens } from "@kimthanh-tutor/contracts";
import { marketConfig } from "@/lib/config";
import { ApiClientError, isApiErrorResponse } from "./errors";
import { createMemoryTokenStore, type TokenStore } from "./session";

type Fetcher = typeof fetch;
let sequence = 0;
const requestId = () => globalThis.crypto?.randomUUID?.() ?? `market-${Date.now()}-${++sequence}`;

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
  idempotencyKey?: string;
  skipAuth?: boolean;
}
export interface ApiClientOptions { baseUrl?: string; fetcher?: Fetcher; tokenStore?: TokenStore; timeoutMs?: number; }

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly tokenStore: TokenStore;
  private readonly timeoutMs: number;
  private refreshPromise: Promise<AuthTokens> | null = null;
  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? marketConfig.apiBaseUrl).replace(/\/$/, "");
    // Native `fetch` phải giữ `this === window`; gọi qua `this.fetcher(...)` với
    // fetch chưa bind sẽ ném "Illegal invocation" trên browser trước khi request
    // rời máy (xem R-01, ai-tasks/16). Bind về global để an toàn.
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.tokenStore = options.tokenStore ?? createMemoryTokenStore();
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }
  request<T>(path: string, options: ApiRequestOptions = {}) { return this.perform<T>(path, options, true); }
  private async perform<T>(path: string, options: ApiRequestOptions, mayRefresh: boolean): Promise<T> {
    const access = options.skipAuth ? null : this.tokenStore.get()?.access_token ?? null;
    const response = await this.send(path, options, access);
    if (response.status === 401 && mayRefresh && !options.skipAuth && path !== "/auth/refresh") {
      if (!access) throw new ApiClientError("Bạn cần đăng nhập để thực hiện yêu cầu này", "api", 401, "AUTH_REQUIRED");
      if (this.tokenStore.get()?.access_token !== access) return this.perform<T>(path, options, false);
      await this.refresh();
      return this.perform<T>(path, options, false);
    }
    if (!response.ok) throw await this.responseError(response);
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; }
    catch { throw new ApiClientError("Phản hồi máy chủ không hợp lệ", "invalid_response", response.status, "INVALID_RESPONSE", undefined, response.headers.get("x-request-id") ?? undefined); }
  }
  private async send(path: string, options: ApiRequestOptions, access: string | null): Promise<Response> {
    const { body, headers: supplied, idempotencyKey, signal: callerSignal, timeoutMs, skipAuth: _skipAuth, ...init } = options;
    const controller = new AbortController();
    if (callerSignal?.aborted) throw new ApiClientError("Yêu cầu đã bị hủy", "aborted", null, "REQUEST_ABORTED");
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs ?? this.timeoutMs);
    const abort = () => controller.abort();
    callerSignal?.addEventListener("abort", abort, { once: true });
    const headers = new Headers(supplied);
    headers.set("accept", "application/json"); headers.set("x-request-id", requestId());
    if (access) headers.set("authorization", `Bearer ${access}`);
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !form) headers.set("content-type", "application/json");
    try { return await this.fetcher(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, { ...init, body: body === undefined ? undefined : form ? body : JSON.stringify(body), headers, signal: controller.signal }); }
    catch (error) {
      if (timedOut) throw new ApiClientError("Yêu cầu quá thời gian chờ", "timeout", null, "REQUEST_TIMEOUT");
      if (callerSignal?.aborted) throw new ApiClientError("Yêu cầu đã bị hủy", "aborted", null, "REQUEST_ABORTED");
      throw new ApiClientError("Không thể kết nối máy chủ", "network", null, "NETWORK_ERROR", error);
    } finally { clearTimeout(timer); callerSignal?.removeEventListener("abort", abort); }
  }
  private async refresh(): Promise<AuthTokens> {
    if (this.refreshPromise) return this.refreshPromise;
    const refreshToken = this.tokenStore.get()?.refresh_token;
    if (!refreshToken) throw new ApiClientError("Phiên đăng nhập đã hết hạn", "api", 401, "AUTH_REQUIRED");
    this.refreshPromise = this.perform<AuthTokens>("/auth/refresh", { method: "POST", body: { refresh_token: refreshToken }, skipAuth: true }, false)
      .then((tokens) => { this.tokenStore.set(tokens); return tokens; })
      .catch((error: unknown) => { this.tokenStore.clear(); throw error; })
      .finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }
  private async responseError(response: Response) {
    let body: unknown = null; try { body = await response.json(); } catch { /* normalized below */ }
    const requestIdHeader = response.headers.get("x-request-id") ?? undefined;
    if (isApiErrorResponse(body)) return new ApiClientError(body.message, "api", response.status, body.code, body.details, body.request_id ?? requestIdHeader);
    return new ApiClientError("Máy chủ trả về lỗi không xác định", "invalid_response", response.status, "INVALID_ERROR_RESPONSE", body, requestIdHeader);
  }
}

export const apiClient = new ApiClient();
