import { ulid } from 'ulid';

// ID = ULID (ai-docs/15). Sắp theo thời gian → tốt cho index ở tải cao.
export const newId = (): string => ulid();
