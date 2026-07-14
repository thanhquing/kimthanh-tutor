import { HttpException } from '@nestjs/common';
import { ErrorCode, ERROR_HTTP_STATUS } from './error-codes';

// Ngoại lệ nghiệp vụ mang mã lỗi chuẩn (06-api-contract).
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(
      { code, message: message ?? code, details },
      ERROR_HTTP_STATUS[code],
    );
  }
}

export const notImplemented = (ref: string): AppException =>
  new AppException(
    ErrorCode.NOT_IMPLEMENTED,
    `Chưa implement. Xem ai-tasks/05-api-endpoints.md: ${ref}`,
  );
