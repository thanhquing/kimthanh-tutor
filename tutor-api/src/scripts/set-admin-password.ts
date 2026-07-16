import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../common/utils/hash.util';

export async function setAdminPassword(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<void> {
  if (!email || password.length < 12 || password.length > 128) {
    throw new Error('ADMIN_EMAIL và ADMIN_PASSWORD (12-128 ký tự) là bắt buộc');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (
    !user ||
    user.deletedAt ||
    user.status === 'deleted' ||
    user.status === 'suspended' ||
    !user.roles.includes('admin')
  ) {
    throw new Error('Email không thuộc tài khoản admin khả dụng');
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.adminCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash },
      update: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      },
    });
    // Rotate password là một sự kiện thu hồi credential: không để refresh
    // token bị đánh cắp tiếp tục sống sau khi operator đổi mật khẩu.
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const prisma = new PrismaClient();
  try {
    await setAdminPassword(prisma, email, password);
    process.stdout.write(`Đã cập nhật mật khẩu admin cho ${email.trim().toLowerCase()}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu admin';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
