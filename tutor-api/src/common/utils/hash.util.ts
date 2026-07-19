import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';

// Hash một chiều sha256 (13-security: không lưu plaintext) — dùng để hash refresh token.
export const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

// Token bí mật ngẫu nhiên (refresh token). Trả plaintext cho client, lưu hash.
export const randomToken = (bytes = 32): string =>
  randomBytes(bytes).toString('base64url');

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;

const derivePasswordKey = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key),
    );
  });

/** Hash mật khẩu bằng scrypt (chậm, chống brute-force); không dùng sha256 nhanh. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltEncoded, keyEncoded] = encoded.split('$');
  if (algorithm !== 'scrypt' || Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P || !saltEncoded || !keyEncoded) return false;
  try {
    const expected = Buffer.from(keyEncoded, 'base64url');
    if (expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = await derivePasswordKey(password, Buffer.from(saltEncoded, 'base64url'));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
