import type { AuthAccessTokenResponse } from "@kimthanh-tutor/contracts";
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
  onSessionExpired?: () => void;
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
  private readonly onSessionExpired?: () => void;
  private refreshPromise: Promise<AuthAccessTokenResponse> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? appConfig.apiBaseUrl).replace(/\/$/, "");
    // Native `fetch` phải giữ `this === window`; lưu trực tiếp rồi gọi qua
    // `this.fetcher(...)` sẽ đổi `this` thành ApiClient và ném "Illegal
    // invocation" trước khi request rời trình duyệt. Bind về global để an toàn.
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.tokenStore = options.tokenStore ?? createMemoryTokenStore();
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.onSessionExpired = options.onSessionExpired;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.perform<T>(path, options, true);
  }

  // Khôi phục phiên sau reload: refresh token nằm trong cookie HttpOnly nên
  // browser tự đính, ta chỉ cần đổi lấy access token mới.
  restoreSession(): Promise<AuthAccessTokenResponse> {
    return this.refresh();
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
        // Gửi kèm cookie HttpOnly `kt_refresh` để `/auth/refresh` và `/auth/logout`
        // đọc được refresh token (cùng-origin nên không rò rỉ cross-site).
        credentials: "include",
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

  private refresh(): Promise<AuthAccessTokenResponse> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.requestRefreshWithConcurrencyRetry()
      .then((tokens) => { this.tokenStore.set(tokens); return tokens; })
      .catch((error: unknown) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.code === "AUTH_REQUIRED")) {
          this.tokenStore.clear();
          this.onSessionExpired?.();
        }
        throw error;
      })
      .finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async requestRefreshWithConcurrencyRetry(attempt = 0): Promise<AuthAccessTokenResponse> {
    try {
      // Không gửi body: refresh token đi qua cookie HttpOnly, server rotate + set lại.
      return await this.perform<AuthAccessTokenResponse>("/auth/refresh", { method: "POST", skipAuth: true }, false);
    } catch (error) {
      // Hai tab dùng chung cookie có thể refresh gần đồng thời; tab thua nhận
      // CONFLICT (409). Chờ Set-Cookie mới rồi thử lại thay vì biến thành logout.
      if (error instanceof ApiClientError && error.status === 409 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        return this.requestRefreshWithConcurrencyRetry(attempt + 1);
      }
      throw error;
    }
  }

  private async toResponseError(response: Response): Promise<ApiClientError> {
    const headerRequestId = response.headers.get("x-request-id") ?? undefined;
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    if (isApiErrorResponse(body)) return new ApiClientError(body.message, "api", response.status, body.code, body.details, body.request_id ?? headerRequestId);
    return new ApiClientError("Máy chủ trả về lỗi không xác định", "invalid_response", response.status, "INVALID_ERROR_RESPONSE", body, headerRequestId);
  }
}

export const appTokenStore = createMemoryTokenStore();
let sessionExpiredHandler: (() => void) | undefined;
export const apiClient = new ApiClient({
  tokenStore: appTokenStore,
  onSessionExpired: () => sessionExpiredHandler?.(),
});

export function setSessionExpiredHandler(handler?: () => void) {
  sessionExpiredHandler = handler;
}
