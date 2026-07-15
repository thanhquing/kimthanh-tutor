import type { ApiErrorResponse } from "@kimthanh-tutor/contracts";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly kind: "api" | "network" | "timeout" | "aborted" | "invalid_response",
    public readonly status: number | null,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) { super(message); this.name = "ApiClientError"; }
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value) && typeof value === "object" && typeof (value as ApiErrorResponse).code === "string" && typeof (value as ApiErrorResponse).message === "string";
}
