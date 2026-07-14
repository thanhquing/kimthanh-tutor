import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

// Hash một chiều cho OTP/destination (13-security: không lưu plaintext).
export const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

export const hashOtp = (code: string, salt: string): string =>
  sha256(`${salt}:${code}`);

export const safeEqualHex = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
};

export const generateOtpCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

// Token bí mật ngẫu nhiên (refresh token). Trả plaintext cho client, lưu hash.
export const randomToken = (bytes = 32): string =>
  randomBytes(bytes).toString('base64url');
