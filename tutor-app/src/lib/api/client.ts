import type { AuthTokens } from "@kimthanh-tutor/contracts";
import { appConfig } from "../config";
import { ApiClientError, isApiErrorResponse } from "./errors";
import { createMemoryTokenStore, type TokenStore } from "./session";

type Fetcher = typeof fetch;
let fallbackRequestSequence = 0;

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
  idempotencyKey?: string;
  skipAuth?: boolean;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
  tokenStore?: TokenStore;
  timeoutMs?: number;
}

function requestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  fallbackRequestSequence = (fallbackRequestSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `req-${Date.now()}-${fallbackRequestSequence}`;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly tokenStore: TokenStore;
  private readonly timeoutMs: number;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? appConfig.apiBaseUrl).replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.tokenStore = options.tokenStore ?? createMemoryTokenStore();
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.perform<T>(path, options, true);
  }

  private async perform<T>(path: string, options: ApiRequestOptions, mayRefresh: boolean): Promise<T> {
    const accessToken = options.skipAuth ? null : this.tokenStore.get()?.access_token ?? null;
    const response = await this.send(path, options, accessToken);

    if (response.status === 401 && mayRefresh && !options.skipAuth && path !== "/auth/refresh") {
      const currentToken = this.tokenStore.get()?.access_token;
      if (!currentToken) throw await this.toResponseError(response);
      if (currentToken === accessToken) await this.refresh();
      return this.perform<T>(path, options, false);
    }

    if (!response.ok) throw await this.toResponseError(response);
    if (response.status === 204) return undefined as T;
    try {
      return await response.json() as T;
    } catch {
      throw new ApiClientError("Phản hồi máy chủ không hợp lệ", "invalid_response", response.status, "INVALID_RESPONSE", undefined, response.headers.get("x-request-id") ?? undefined);
    }
  }

  private async send(path: string, options: ApiRequestOptions, accessToken: string | null): Promise<Response> {
    const {
      body,
      headers: suppliedHeaders,
      idempotencyKey,
      signal: callerSignal,
      timeoutMs,
      ...requestInit
    } = options;
    delete requestInit.skipAuth;
    const controller = new AbortController();
    if (callerSignal?.aborted) {
      controller.abort();
      throw new ApiClientError("Yêu cầu đã bị hủy", "aborted", null, "REQUEST_ABORTED");
    }

    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs ?? this.timeoutMs);
    const abortFromCaller = () => controller.abort();
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

    const headers = new Headers(suppliedHeaders);
    headers.set("accept", "application/json");
    headers.set("x-request-id", requestId());
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const hasBody = body !== undefined;
    if (hasBody && !isFormData) headers.set("content-type", "application/json");

    try {
      return await this.fetcher(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        ...requestInit,
        body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new ApiClientError("Yêu cầu quá thời gian chờ", "timeout", null, "REQUEST_TIMEOUT");
      if (callerSignal?.aborted) throw new ApiClientError("Yêu cầu đã bị hủy", "aborted", null, "REQUEST_ABORTED");
      throw new ApiClientError("Không thể kết nối máy chủ", "network", null, "NETWORK_ERROR", error);
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
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

  private async toResponseError(response: Response): Promise<ApiClientError> {
    const headerRequestId = response.headers.get("x-request-id") ?? undefined;
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    if (isApiErrorResponse(body)) return new ApiClientError(body.message, "api", response.status, body.code, body.details, body.request_id ?? headerRequestId);
    return new ApiClientError("Máy chủ trả về lỗi không xác định", "invalid_response", response.status, "INVALID_ERROR_RESPONSE", body, headerRequestId);
  }
}

export const apiClient = new ApiClient();
