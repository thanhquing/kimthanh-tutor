import { Prisma } from '@prisma/client';

// Client dùng được cả ngoài lẫn trong $transaction (PrismaService khớp kiểu này).
export type Db = Prisma.TransactionClient;
