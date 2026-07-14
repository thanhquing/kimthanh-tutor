// Keyset (seek) pagination — không dùng offset (12-non-functional-requirements).

export type CursorValue = string | number | null;

export interface KeysetResult<T> {
  items: T[];
  next_cursor: string | null;
}

// Cursor mã hóa base64url của JSON [sortValue, id]. sortValue có thể null
// (vd cột fee nullable) để keyset phân biệt vùng null.
export function encodeCursor(sortValue: CursorValue, id: string): string {
  return Buffer.from(JSON.stringify([sortValue, id])).toString('base64url');
}

export function decodeCursor(cursor?: string): [CursorValue, string] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      (parsed[0] === null ||
        typeof parsed[0] === 'string' ||
        typeof parsed[0] === 'number') &&
      typeof parsed[1] === 'string'
    ) {
      return [parsed[0], parsed[1]];
    }
    return null;
  } catch {
    return null;
  }
}

// Cắt trang: lấy limit+1 để biết còn trang sau, trả cursor từ item cuối.
export function buildKeyset<T>(
  rows: T[],
  limit: number,
  makeCursor: (row: T) => string,
): KeysetResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next_cursor =
    hasMore && items.length > 0 ? makeCursor(items[items.length - 1]) : null;
  return { items, next_cursor };
}

export const clampLimit = (limit: unknown, def = 20, max = 50): number => {
  const n = typeof limit === 'string' ? parseInt(limit, 10) : Number(limit);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
};
