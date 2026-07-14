import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ErrorCode, ERROR_HTTP_STATUS } from '../errors/error-codes';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

// Chuẩn hóa mọi lỗi về dạng { code, message, details?, request_id } (06-api-contract).
// Map cả lỗi Prisma đã biết (unique/not-found/fk/optimistic-lock) về mã chuẩn ở
// MỘT chỗ, để service không phải try/catch lặp lại từng module.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    const { status, body } = this.resolve(exception);
    body.request_id = req.requestId;

    if (status >= 500) {
      this.logger.error(
        `[${req.requestId ?? '-'}] ${req.method} ${req.url} -> ${status}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; body: ErrorBody } {
    // 1) Ngoại lệ HTTP của Nest (bao gồm AppException + ValidationPipe).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        return { status, body: { code: this.mapStatus(status), message: resp } };
      }
      const r = resp as Record<string, unknown>;
      // ValidationPipe trả message dạng mảng.
      if (Array.isArray(r.message)) {
        return {
          status,
          body: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Dữ liệu không hợp lệ',
            details: r.message,
          },
        };
      }
      return {
        status,
        body: {
          code: (r.code as string) ?? this.mapStatus(status),
          message: (r.message as string) ?? 'Lỗi',
          details: r.details,
        },
      };
    }

    // 2) Lỗi Prisma đã biết → mã nghiệp vụ chuẩn.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrisma(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: ERROR_HTTP_STATUS[ErrorCode.VALIDATION_ERROR],
        body: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Tham số truy vấn không hợp lệ',
        },
      };
    }

    // 3) Còn lại → 500 (không lộ chi tiết nội bộ).
    return {
      status: ERROR_HTTP_STATUS[ErrorCode.INTERNAL_ERROR],
      body: { code: ErrorCode.INTERNAL_ERROR, message: 'Lỗi hệ thống' },
    };
  }

  private mapPrisma(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ErrorBody;
  } {
    let code: ErrorCode;
    let message: string;
    switch (e.code) {
      case 'P2002': // unique constraint
        code = ErrorCode.CONFLICT;
        message = 'Dữ liệu đã tồn tại';
        break;
      case 'P2025': // record not found (update/delete)
        code = ErrorCode.RESOURCE_NOT_FOUND;
        message = 'Không tìm thấy tài nguyên';
        break;
      case 'P2003': // foreign key constraint
        code = ErrorCode.VALIDATION_ERROR;
        message = 'Tham chiếu không hợp lệ';
        break;
      case 'P2034': // write conflict / deadlock
        code = ErrorCode.CONFLICT;
        message = 'Xung đột ghi dữ liệu, thử lại';
        break;
      default:
        code = ErrorCode.INTERNAL_ERROR;
        message = 'Lỗi cơ sở dữ liệu';
    }
    return {
      status: ERROR_HTTP_STATUS[code],
      body: { code, message, details: { prisma_code: e.code } },
    };
  }

  private mapStatus(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_ERROR;
      case 401:
        return ErrorCode.AUTH_REQUIRED;
      case 402:
        return ErrorCode.PAYMENT_REQUIRED;
      case 403:
        return ErrorCode.FORBIDDEN_ROLE;
      case 404:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 429:
        return ErrorCode.RATE_LIMITED;
      case 501:
        return ErrorCode.NOT_IMPLEMENTED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
