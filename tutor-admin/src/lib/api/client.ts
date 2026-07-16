import type { AdminAccessTokenResponse } from "@kimthanh-tutor/contracts";
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
  fallbackRequestSequence =
    (fallbackRequestSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `req-${Date.now()}-${fallbackRequestSequence}`;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly tokenStore: TokenStore;
  private readonly timeoutMs: number;
  private readonly onSessionExpired?: () => void;
  private refreshPromise: Promise<AdminAccessTokenResponse> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? appConfig.apiBaseUrl).replace(/\/$/, "");
    // Gọi fetch qua globalThis để giữ đúng receiver trên browser thật.
    this.fetcher =
      options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.tokenStore = options.tokenStore ?? createMemoryTokenStore();
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.onSessionExpired = options.onSessionExpired;
  }

  request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.perform<T>(path, options, true);
  }

  restoreSession(): Promise<AdminAccessTokenResponse> {
    return this.refresh();
  }

  private async perform<T>(
    path: string,
    options: ApiRequestOptions,
    mayRefresh: boolean,
  ): Promise<T> {
    const accessToken = options.skipAuth
      ? null
      : (this.tokenStore.get()?.access_token ?? null);
    const response = await this.send(path, options, accessToken);
    if (
      response.status === 401 &&
      mayRefresh &&
      !options.skipAuth &&
      path !== "/auth/admin/refresh"
    ) {
      if (!this.tokenStore.get()?.access_token)
        throw await this.toResponseError(response);
      try {
        if (this.tokenStore.get()?.access_token === accessToken)
          await this.refresh();
      } catch (error) {
        this.expire();
        throw error;
      }
      return this.perform<T>(path, options, false);
    }
    if (!response.ok) {
      if (response.status === 401 && !options.skipAuth) this.expire();
      throw await this.toResponseError(response);
    }
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiClientError(
        "Phản hồi máy chủ không hợp lệ",
        "invalid_response",
        response.status,
        "INVALID_RESPONSE",
        undefined,
        response.headers.get("x-request-id") ?? undefined,
      );
    }
  }

  private async send(
    path: string,
    options: ApiRequestOptions,
    accessToken: string | null,
  ): Promise<Response> {
    const {
      body,
      headers: suppliedHeaders,
      idempotencyKey,
      signal: callerSignal,
      timeoutMs,
      ...requestInit
    } = options;
    delete requestInit.skipAuth;
    if (callerSignal?.aborted)
      throw new ApiClientError(
        "Yêu cầu đã bị hủy",
        "aborted",
        null,
        "REQUEST_ABORTED",
      );
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs ?? this.timeoutMs);
    const abort = () => controller.abort();
    callerSignal?.addEventListener("abort", abort, { once: true });
    const headers = new Headers(suppliedHeaders);
    headers.set("accept", "application/json");
    headers.set("x-request-id", requestId());
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isFormData)
      headers.set("content-type", "application/json");
    try {
      return await this.fetcher(
        `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
        {
          credentials: "include",
          ...requestInit,
          body:
            body === undefined
              ? undefined
              : isFormData
                ? body
                : JSON.stringify(body),
          headers,
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (timedOut)
        throw new ApiClientError(
          "Yêu cầu quá thời gian chờ",
          "timeout",
          null,
          "REQUEST_TIMEOUT",
        );
      if (callerSignal?.aborted)
        throw new ApiClientError(
          "Yêu cầu đã bị hủy",
          "aborted",
          null,
          "REQUEST_ABORTED",
        );
      throw new ApiClientError(
        "Không thể kết nối máy chủ",
        "network",
        null,
        "NETWORK_ERROR",
        error,
      );
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abort);
    }
  }

  private refresh(): Promise<AdminAccessTokenResponse> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.requestRefreshWithConcurrencyRetry()
      .then((tokens) => {
        this.tokenStore.set(tokens);
        return tokens;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  private async requestRefreshWithConcurrencyRetry(
    attempt = 0,
  ): Promise<AdminAccessTokenResponse> {
    try {
      return await this.perform<AdminAccessTokenResponse>(
        "/auth/admin/refresh",
        { method: "POST", skipAuth: true },
        false,
      );
    } catch (error) {
      // Cookie HttpOnly dùng chung giữa các tab. Nếu tab khác vừa thắng CAS,
      // chờ Set-Cookie mới rồi thử lại thay vì biến xung đột thành logout.
      if (error instanceof ApiClientError && error.status === 409 && attempt < 2) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 100 * (attempt + 1)),
        );
        return this.requestRefreshWithConcurrencyRetry(attempt + 1);
      }
      throw error;
    }
  }

  private expire() {
    this.tokenStore.clear();
    this.onSessionExpired?.();
  }

  private async toResponseError(response: Response): Promise<ApiClientError> {
    const headerRequestId = response.headers.get("x-request-id") ?? undefined;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (isApiErrorResponse(body))
      return new ApiClientError(
        body.message,
        "api",
        response.status,
        body.code,
        body.details,
        body.request_id ?? headerRequestId,
      );
    return new ApiClientError(
      "Máy chủ trả về lỗi không xác định",
      "invalid_response",
      response.status,
      "INVALID_ERROR_RESPONSE",
      body,
      headerRequestId,
    );
  }
}
