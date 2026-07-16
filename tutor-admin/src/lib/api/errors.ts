import type { ApiErrorResponse } from "@kimthanh-tutor/contracts";

export type ClientErrorKind = "api" | "network" | "timeout" | "aborted" | "invalid_response";

export class ApiClientError extends Error {
  constructor(message: string, readonly kind: ClientErrorKind, readonly status: number | null = null, readonly code = "CLIENT_ERROR", readonly details?: unknown, readonly requestId?: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.code === "string" && typeof body.message === "string";
}
