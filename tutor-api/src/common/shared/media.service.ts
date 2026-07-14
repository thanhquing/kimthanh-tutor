import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

const MAX_SIZE: Record<string, number> = {
  avatar: 5 * 1024 * 1024, // 5MB
  intro_video: 100 * 1024 * 1024, // 100MB
  other: 10 * 1024 * 1024,
};

const ALLOWED_TYPES: Record<string, RegExp> = {
  avatar: /^image\/(png|jpe?g|webp)$/,
  intro_video: /^video\/(mp4|webm|quicktime)$/,
  other: /^(image|video|application)\//,
};

// Ký URL upload/đọc media bằng HMAC (13-security: signed URL hết hạn ngắn).
// Backend lưu trữ (S3-compatible) cắm qua STORAGE_*; logic ký là thật, không
// phụ thuộc SDK cụ thể — service lưu trữ xác thực chữ ký + expiry ở tầng edge.
@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>('media.signingSecret') ?? 'dev-media-signing';
  }

  private endpoint(): string {
    return (
      this.config.get<string>('media.storageEndpoint') ||
      'https://storage.local'
    );
  }

  private bucket(): string {
    return this.config.get<string>('media.storageBucket') || 'media';
  }

  private sign(method: string, storageKey: string, expiresAtSec: number): string {
    return createHmac('sha256', this.secret())
      .update(`${method}:${storageKey}:${expiresAtSec}`)
      .digest('hex');
  }

  validate(kind: string, contentType: string, sizeBytes: number): void {
    const allowed = ALLOWED_TYPES[kind] ?? ALLOWED_TYPES.other;
    if (!allowed.test(contentType)) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `Content-Type ${contentType} không hợp lệ cho ${kind}`,
      );
    }
    const max = MAX_SIZE[kind] ?? MAX_SIZE.other;
    if (sizeBytes <= 0 || sizeBytes > max) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `Kích thước vượt giới hạn (${max} bytes)`,
      );
    }
  }

  storageKeyFor(ownerUserId: string, mediaId: string, kind: string): string {
    return `${kind}/${ownerUserId}/${mediaId}`;
  }

  createUploadUrl(
    storageKey: string,
    ttlSec = 600,
  ): { url: string; expires_at: string } {
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = this.sign('PUT', storageKey, expires);
    const url = `${this.endpoint()}/${this.bucket()}/${storageKey}?method=PUT&expires=${expires}&sig=${sig}`;
    return { url, expires_at: new Date(expires * 1000).toISOString() };
  }

  signedReadUrl(storageKey: string | null, ttlSec = 300): string | null {
    if (!storageKey) return null;
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = this.sign('GET', storageKey, expires);
    return `${this.endpoint()}/${this.bucket()}/${storageKey}?expires=${expires}&sig=${sig}`;
  }
}
